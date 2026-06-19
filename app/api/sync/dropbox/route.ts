/**
 * GET  /api/sync/dropbox — status da integração (configurado? planilha encontrada? último sync)
 * POST /api/sync/dropbox — sincroniza a planilha mais recente da pasta do Dropbox → Supabase
 *
 * Acesso restrito a setores: financeiro, executivo
 */

import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/auth-server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getPortalSectorFromEmail } from "@/lib/portal-sector";
import { transformSheetRows, upsertLancamentos } from "@/lib/lancamentos-transform";
import { parseSpreadsheetFile } from "@/lib/file-parsers";
import {
  isDropboxConfigured,
  findLatestSpreadsheet,
  downloadFileContent,
} from "@/lib/dropbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WRITE_SECTORS = new Set(["financeiro", "executivo"]);

// ─── GET — status ─────────────────────────────────────────────────────────────

export async function GET() {
  const portal = await requirePortalSession();
  if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const sb = createSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });

  const { data: lastSync } = await sb
    .from("portal_sheets_sync_log")
    .select("*")
    .like("triggered_by", "dropbox%")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    configured: isDropboxConfigured(),
    last_sync: lastSync ?? null,
  });
}

// ─── POST — sincronizar ──────────────────────────────────────────────────────

export async function POST() {
  const portal = await requirePortalSession();
  if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const sector = getPortalSectorFromEmail((portal as any).email ?? "");
  if (!WRITE_SECTORS.has(sector)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const sb = createSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });

  if (!isDropboxConfigured()) {
    return NextResponse.json(
      { error: "Integração com Dropbox não configurada." },
      { status: 503 }
    );
  }

  const { data: logRow } = await sb
    .from("portal_sheets_sync_log")
    .insert({
      started_at: new Date().toISOString(),
      status: "running",
      triggered_by: `dropbox:${(portal as any).email ?? "desconhecido"}`,
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

  try {
    const file = await findLatestSpreadsheet();
    if (!file) {
      await updateLog("error", 0, 0, "Nenhuma planilha (.xlsx/.csv) encontrada na pasta do Dropbox.");
      return NextResponse.json(
        { error: "Nenhuma planilha (.xlsx/.csv) encontrada na pasta do Dropbox." },
        { status: 422 }
      );
    }

    const buffer = await downloadFileContent(file.pathLower);
    const rawRows = await parseSpreadsheetFile(file.name, buffer);

    if (rawRows.length < 2) {
      await updateLog("error", 0, 0, "Planilha vazia ou sem dados.");
      return NextResponse.json({ error: "Planilha vazia ou sem dados." }, { status: 422 });
    }

    const { records, rowsRead, columnsDetected } = transformSheetRows(rawRows);

    if (records.length === 0) {
      await updateLog("error", rowsRead, 0, "Nenhum registro válido encontrado na planilha.");
      return NextResponse.json({ error: "Nenhum registro válido encontrado na planilha." }, { status: 422 });
    }

    const totalUpserted = await upsertLancamentos(sb, records);
    await updateLog("success", rowsRead, totalUpserted);

    return NextResponse.json({
      ok: true,
      file_name: file.name,
      rows_read: rowsRead,
      rows_upserted: totalUpserted,
      columns_detected: columnsDetected,
    });
  } catch (err: any) {
    const partial = (err?.cause as { totalUpserted?: number } | undefined)?.totalUpserted ?? 0;
    await updateLog("error", 0, partial, err?.message);
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}
