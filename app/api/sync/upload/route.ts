/**
 * POST /api/sync/upload
 *
 * Importa lançamentos diretamente de um arquivo CSV ou XLSX
 * (sem precisar de Google Sheets / Conta de Serviço).
 *
 * Body: multipart/form-data com campo "file"
 * Acesso restrito a setores: financeiro, executivo
 */

import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/auth-server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getPortalSectorFromEmail } from "@/lib/portal-sector";
import { transformSheetRows, upsertLancamentos } from "@/lib/lancamentos-transform";
import { parseCSV, parseXLSX } from "@/lib/file-parsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WRITE_SECTORS = new Set(["financeiro", "executivo"]);
const MAX_FILE_MB = 50;

export async function POST(req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const sector = getPortalSectorFromEmail((portal as any).email ?? "");
    if (!WRITE_SECTORS.has(sector)) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const sb = createSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });

    // ── Parse multipart ───────────────────────────────────────────────────────
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_FILE_MB) {
      return NextResponse.json(
        { error: `Arquivo muito grande (${sizeMB.toFixed(1)} MB). Máximo: ${MAX_FILE_MB} MB.` },
        { status: 413 }
      );
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    // ── Parse para array de linhas string[][] ─────────────────────────────────
    let rawRows: string[][];

    if (fileName.endsWith(".csv")) {
      rawRows = parseCSV(buffer.toString("utf-8"));
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      rawRows = await parseXLSX(buffer);
    } else {
      return NextResponse.json(
        { error: "Formato não suportado. Envie um arquivo .csv ou .xlsx." },
        { status: 415 }
      );
    }

    if (rawRows.length < 2) {
      return NextResponse.json({ error: "Arquivo vazio ou sem dados." }, { status: 422 });
    }

    // ── Log de início ─────────────────────────────────────────────────────────
    const { data: logRow } = await sb
      .from("portal_sheets_sync_log")
      .insert({
        started_at: new Date().toISOString(),
        status: "running",
        triggered_by: `upload:${(portal as any).email ?? "desconhecido"}`,
      })
      .select("id")
      .single();
    const logId = logRow?.id as string | undefined;

    const updateLog = async (
      status: "success" | "error",
      rowsRead: number,
      rowsUpserted: number,
      errorMessage?: string
    ) => {
      if (!logId) return;
      await sb.from("portal_sheets_sync_log").update({
        finished_at: new Date().toISOString(),
        status,
        rows_read: rowsRead,
        rows_upserted: rowsUpserted,
        error_message: errorMessage ?? null,
      }).eq("id", logId);
    };

    // ── Transforma linhas ─────────────────────────────────────────────────────
    const { records, rowsRead, columnsDetected } = transformSheetRows(rawRows);

    if (records.length === 0) {
      await updateLog("error", rowsRead, 0, "Nenhum registro válido encontrado.");
      return NextResponse.json(
        {
          error:
            "Nenhum registro válido no arquivo. Certifique-se de usar a aba " +
            "'personalizadoFinanceiro (13)' exportada como CSV UTF-8.",
        },
        { status: 422 }
      );
    }

    // ── Upsert em lotes ───────────────────────────────────────────────────────
    let totalUpserted = 0;
    try {
      totalUpserted = await upsertLancamentos(sb, records);
    } catch (err: any) {
      const partial = (err?.cause as { totalUpserted?: number } | undefined)?.totalUpserted ?? 0;
      await updateLog("error", rowsRead, partial, err?.message);
      return NextResponse.json({ error: err?.message }, { status: 500 });
    }

    await updateLog("success", rowsRead, totalUpserted);

    return NextResponse.json({
      ok: true,
      rows_read: rowsRead,
      rows_upserted: totalUpserted,
      columns_detected: columnsDetected,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}
