/**
 * GET /api/cron/sync-onedrive
 *
 * Endpoint chamado automaticamente pelo Vercel Cron (vercel.json) para
 * sincronizar periodicamente a planilha do OneDrive → Supabase.
 *
 * Autenticação: Authorization: Bearer <CRON_SECRET>
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { transformSheetRows, upsertLancamentos } from "@/lib/lancamentos-transform";
import { parseSpreadsheetFile } from "@/lib/file-parsers";
import {
  isOneDriveConfigured,
  getValidAccessToken,
  getShareUrl,
  resolveSharedItem,
  findSpreadsheetItem,
  downloadDriveItemContent,
  OneDriveReauthRequiredError,
} from "@/lib/onedrive";

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

  if (!isOneDriveConfigured()) {
    return NextResponse.json({ error: "Integração com OneDrive não configurada." }, { status: 503 });
  }

  const sb = createSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });

  const shareUrl = await getShareUrl(sb);
  if (!shareUrl) {
    return NextResponse.json({ error: "Nenhum link do OneDrive configurado." }, { status: 422 });
  }

  let accessToken: string | null;
  try {
    accessToken = await getValidAccessToken(sb);
  } catch (err: any) {
    if (err instanceof OneDriveReauthRequiredError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
  if (!accessToken) {
    return NextResponse.json({ error: "Conta Microsoft não conectada." }, { status: 401 });
  }

  const { data: logRow } = await sb
    .from("portal_sheets_sync_log")
    .insert({
      started_at: new Date().toISOString(),
      status: "running",
      triggered_by: "onedrive:cron",
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
    const root = await resolveSharedItem(shareUrl, accessToken);
    const fileItem = findSpreadsheetItem(root);
    if (!fileItem) {
      await updateLog("error", 0, 0, "Nenhuma planilha (.xlsx/.csv) encontrada no link compartilhado.");
      return NextResponse.json({ error: "Nenhuma planilha encontrada no link compartilhado." }, { status: 422 });
    }

    const buffer = await downloadDriveItemContent(fileItem.driveId, fileItem.itemId, accessToken);
    const rawRows = await parseSpreadsheetFile(fileItem.name, buffer);

    if (rawRows.length < 2) {
      await updateLog("error", 0, 0, "Planilha vazia ou sem dados.");
      return NextResponse.json({ error: "Planilha vazia ou sem dados." }, { status: 422 });
    }

    const { records, rowsRead } = transformSheetRows(rawRows);
    const totalUpserted = await upsertLancamentos(sb, records);
    await updateLog("success", rowsRead, totalUpserted);

    return NextResponse.json({
      ok: true,
      file_name: fileItem.name,
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
