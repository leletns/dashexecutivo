/**
 * POST /api/sync/sheets   — dispara sincronização Google Sheets → Supabase
 * GET  /api/sync/sheets   — retorna status do último sync
 *
 * Acesso restrito a setores: financeiro, executivo
 */

import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/auth-server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getPortalSectorFromEmail } from "@/lib/portal-sector";
import { readSheetValues } from "@/lib/google-sheets";
import { transformSheetRows, upsertLancamentos } from "@/lib/lancamentos-transform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WRITE_SECTORS = new Set(["financeiro", "executivo"]);

// ─── GET — status do último sync ─────────────────────────────────────────────

export async function GET(_req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const sb = createSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });

    let { data: lastSync } = await sb
      .from("portal_sheets_sync_log")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Auto-fecha logs presos em "running" por mais de 10 minutos
    if (lastSync?.status === "running" && lastSync.started_at) {
      const ageMs = Date.now() - new Date(lastSync.started_at).getTime();
      if (ageMs > 10 * 60 * 1000) {
        const { data: updated } = await sb
          .from("portal_sheets_sync_log")
          .update({
            status: "success",
            finished_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", lastSync.id)
          .select("*")
          .single();
        if (updated) lastSync = updated;
      }
    }

    const { count: totalLancamentos } = await sb
      .from("portal_lancamentos")
      .select("*", { count: "exact", head: true });

    const configured =
      !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64 &&
      !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    return NextResponse.json({
      configured,
      last_sync: lastSync ?? null,
      total_lancamentos: totalLancamentos ?? 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}

// ─── POST — executar sync ─────────────────────────────────────────────────────

export async function POST(_req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const sector = getPortalSectorFromEmail((portal as any).email ?? "");
    if (!WRITE_SECTORS.has(sector)) {
      return NextResponse.json({ error: "Sem permissão para sincronização." }, { status: 403 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const sheetName =
      process.env.GOOGLE_SHEETS_SHEET_NAME ?? "personalizadoFinanceiro (13)";

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64 || !spreadsheetId) {
      return NextResponse.json(
        {
          error:
            "Google Sheets não configurado. Adicione GOOGLE_SERVICE_ACCOUNT_KEY_B64 e " +
            "GOOGLE_SHEETS_SPREADSHEET_ID nas variáveis de ambiente.",
        },
        { status: 503 }
      );
    }

    const sb = createSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });

    // ── Log de início ─────────────────────────────────────────────────────────
    const { data: logRow } = await sb
      .from("portal_sheets_sync_log")
      .insert({
        started_at: new Date().toISOString(),
        status: "running",
        triggered_by: (portal as any).email ?? "desconhecido",
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

    // ── 1. Lê a planilha ──────────────────────────────────────────────────────
    let rawRows: string[][];
    try {
      rawRows = await readSheetValues(spreadsheetId, sheetName);
    } catch (err: any) {
      await updateLog("error", 0, 0, err?.message);
      return NextResponse.json({ error: `Erro ao ler planilha: ${err?.message}` }, { status: 502 });
    }

    if (rawRows.length === 0) {
      await updateLog("error", 0, 0, "Planilha vazia.");
      return NextResponse.json({ error: "Planilha vazia." }, { status: 422 });
    }

    // ── 2. Transforma linhas ───────────────────────────────────────────────────
    const { records, rowsRead, columnsDetected } = transformSheetRows(rawRows);

    // ── 3. Upsert em lotes ────────────────────────────────────────────────────
    let totalUpserted = 0;
    try {
      totalUpserted = await upsertLancamentos(sb, records);
    } catch (err: any) {
      const partial = (err?.cause as { totalUpserted?: number } | undefined)?.totalUpserted ?? 0;
      await updateLog("error", rowsRead, partial, err?.message);
      return NextResponse.json({ error: err?.message }, { status: 500 });
    }

    // ── 4. Finaliza ───────────────────────────────────────────────────────────
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
