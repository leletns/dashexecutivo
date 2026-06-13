/**
 * GET    /api/sync/onedrive — status da integração (conectado? planilha configurada? último sync)
 * POST   /api/sync/onedrive — sincroniza a planilha do OneDrive → Supabase
 * DELETE /api/sync/onedrive — desconecta a conta Microsoft
 *
 * Body do POST (opcional): { "share_url": "https://1drv.ms/..." } — salva/atualiza
 * o link da pasta ou arquivo compartilhado antes de sincronizar.
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
  isOneDriveConfigured,
  getConnectionInfo,
  getValidAccessToken,
  getShareUrl,
  setShareUrl,
  resolveSharedItem,
  findSpreadsheetItem,
  downloadDriveItemContent,
  disconnect,
} from "@/lib/onedrive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WRITE_SECTORS = new Set(["financeiro", "executivo"]);

// ─── GET — status ─────────────────────────────────────────────────────────────

export async function GET() {
  const portal = await requirePortalSession();
  if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const sb = createSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });

  const [{ connected, account_label }, shareUrl, lastSyncRes] = await Promise.all([
    getConnectionInfo(sb),
    getShareUrl(sb),
    sb
      .from("portal_sheets_sync_log")
      .select("*")
      .like("triggered_by", "onedrive%")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    configured: isOneDriveConfigured(),
    connected,
    account_label,
    share_url: shareUrl,
    last_sync: lastSyncRes.data ?? null,
  });
}

// ─── POST — sincronizar ──────────────────────────────────────────────────────

export async function POST(req: Request) {
  const portal = await requirePortalSession();
  if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const sector = getPortalSectorFromEmail((portal as any).email ?? "");
  if (!WRITE_SECTORS.has(sector)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const sb = createSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });

  if (!isOneDriveConfigured()) {
    return NextResponse.json(
      { error: "Integração com OneDrive não configurada." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const shareUrlInput = typeof body?.share_url === "string" ? body.share_url.trim() : "";
  if (shareUrlInput) await setShareUrl(sb, shareUrlInput);

  const shareUrl = shareUrlInput || (await getShareUrl(sb));
  if (!shareUrl) {
    return NextResponse.json(
      { error: "Nenhum link do OneDrive configurado. Informe o link da pasta ou arquivo compartilhado." },
      { status: 422 }
    );
  }

  const accessToken = await getValidAccessToken(sb);
  if (!accessToken) {
    return NextResponse.json(
      { error: "Conta Microsoft não conectada. Clique em 'Conectar conta Microsoft'." },
      { status: 401 }
    );
  }

  const { data: logRow } = await sb
    .from("portal_sheets_sync_log")
    .insert({
      started_at: new Date().toISOString(),
      status: "running",
      triggered_by: `onedrive:${(portal as any).email ?? "desconhecido"}`,
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
      return NextResponse.json(
        { error: "Nenhuma planilha (.xlsx/.csv) encontrada no link compartilhado." },
        { status: 422 }
      );
    }

    const buffer = await downloadDriveItemContent(fileItem.driveId, fileItem.itemId, accessToken);
    const rawRows = await parseSpreadsheetFile(fileItem.name, buffer);

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
      file_name: fileItem.name,
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

// ─── DELETE — desconectar conta ──────────────────────────────────────────────

export async function DELETE() {
  const portal = await requirePortalSession();
  if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const sector = getPortalSectorFromEmail((portal as any).email ?? "");
  if (!WRITE_SECTORS.has(sector)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const sb = createSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });

  await disconnect(sb);
  return NextResponse.json({ ok: true });
}
