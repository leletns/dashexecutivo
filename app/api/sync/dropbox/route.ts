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
import { isDropboxConfigured } from "@/lib/dropbox";
import { runDropboxSync, DropboxSyncError } from "@/lib/dropbox-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WRITE_SECTORS = new Set(["financeiro", "executivo"]);
// Auto-sync ao abrir o painel não deve repetir trabalho pesado: se já rodou
// nos últimos 120s, pula (a menos que ?force=1, usado no botão "sincronizar agora").
const DEBOUNCE_MS = 120_000;

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

export async function POST(req: Request) {
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

  // Debounce: o painel dispara este sync ao abrir; se já rodou há pouco, pula
  // (a menos que ?force=1, usado no botão manual "sincronizar agora").
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (!force) {
    const desde = new Date(Date.now() - DEBOUNCE_MS).toISOString();
    const { data: recente } = await sb
      .from("portal_sheets_sync_log")
      .select("id")
      .like("triggered_by", "dropbox%")
      .gte("started_at", desde)
      .limit(1)
      .maybeSingle();
    if (recente) return NextResponse.json({ ok: true, skipped: "sincronizado_recentemente" });
  }

  try {
    const result = await runDropboxSync(sb, `dropbox:${(portal as any).email ?? "desconhecido"}`);
    return NextResponse.json(result);
  } catch (err) {
    const e = err as DropboxSyncError;
    return NextResponse.json({ error: e?.message ?? "Erro interno." }, { status: e?.status ?? 500 });
  }
}
