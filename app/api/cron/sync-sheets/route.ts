/**
 * GET /api/cron/sync-sheets
 *
 * Endpoint chamado automaticamente pelo Vercel Cron (vercel.json)
 * e pelo Google Apps Script da planilha.
 *
 * Autenticação: Authorization: Bearer <CRON_SECRET>
 * Executa a mesma sincronização Google Sheets → Supabase do endpoint manual.
 *
 * Configure em Vercel → Settings → Environment Variables:
 *   CRON_SECRET = qualquer string longa e aleatória
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { readSheetValues } from "@/lib/google-sheets";
import { transformSheetRows, upsertLancamentos } from "@/lib/lancamentos-transform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleSync(req);
}

export async function POST(req: Request) {
  return handleSync(req);
}

async function handleSync(req: Request) {
  // ── Auth via CRON_SECRET ───────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

  if (token !== cronSecret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // ── Verifica variáveis ────────────────────────────────────────────────────
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME ?? "personalizadoFinanceiro (13)";

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64 || !spreadsheetId) {
    return NextResponse.json({
      error: "Google Sheets não configurado. Adicione GOOGLE_SERVICE_ACCOUNT_KEY_B64 e GOOGLE_SHEETS_SPREADSHEET_ID.",
    }, { status: 503 });
  }

  const sb = createSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });

  // ── Log de início ─────────────────────────────────────────────────────────
  const { data: logRow } = await sb
    .from("portal_sheets_sync_log")
    .insert({
      started_at: new Date().toISOString(),
      status: "running",
      triggered_by: "cron:auto",
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

  // ── 1. Lê planilha ────────────────────────────────────────────────────────
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

  // ── 2. Transforma linhas ──────────────────────────────────────────────────
  const { records, rowsRead } = transformSheetRows(rawRows);

  // ── 3. Upsert em lotes ────────────────────────────────────────────────────
  let totalUpserted = 0;
  try {
    totalUpserted = await upsertLancamentos(sb, records);
  } catch (err: any) {
    const partial = (err?.cause as { totalUpserted?: number } | undefined)?.totalUpserted ?? 0;
    await updateLog("error", rowsRead, partial, err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  await updateLog("success", rowsRead, totalUpserted);

  return NextResponse.json({
    ok: true,
    rows_read: rowsRead,
    rows_upserted: totalUpserted,
    triggered_at: now,
  });
}
