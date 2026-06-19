/**
 * GET /api/cron/sync-dropbox
 *
 * Endpoint chamado automaticamente pelo Vercel Cron (vercel.json) para
 * sincronizar periodicamente a planilha mais recente da pasta do Dropbox → Supabase.
 *
 * Autenticação: Authorization: Bearer <CRON_SECRET>
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { transformSheetRows, upsertLancamentos } from "@/lib/lancamentos-transform";
import { parseSpreadsheetFile } from "@/lib/file-parsers";
import {
  isDropboxConfigured,
  findLatestSpreadsheet,
  downloadFileContent,
} from "@/lib/dropbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleSync(req);
}

export async function POST(req: Request) {
  return handleSync(req);
}

async function handleSync(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (token !== cronSecret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!isDropboxConfigured()) {
    return NextResponse.json({ error: "Integração com Dropbox não configurada." }, { status: 503 });
  }

  const sb = createSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });

  const { data: logRow } = await sb
    .from("portal_sheets_sync_log")
    .insert({
      started_at: new Date().toISOString(),
      status: "running",
      triggered_by: "dropbox:cron",
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
      return NextResponse.json({ error: "Nenhuma planilha encontrada na pasta do Dropbox." }, { status: 422 });
    }

    const buffer = await downloadFileContent(file.pathLower);
    const rawRows = await parseSpreadsheetFile(file.name, buffer);

    if (rawRows.length < 2) {
      await updateLog("error", 0, 0, "Planilha vazia ou sem dados.");
      return NextResponse.json({ error: "Planilha vazia ou sem dados." }, { status: 422 });
    }

    const { records, rowsRead } = transformSheetRows(rawRows);
    const totalUpserted = await upsertLancamentos(sb, records);
    await updateLog("success", rowsRead, totalUpserted);

    return NextResponse.json({
      ok: true,
      file_name: file.name,
      rows_read: rowsRead,
      rows_upserted: totalUpserted,
      triggered_at: new Date().toISOString(),
    });
  } catch (err: any) {
    const partial = (err?.cause as { totalUpserted?: number } | undefined)?.totalUpserted ?? 0;
    await updateLog("error", 0, partial, err?.message);
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}
