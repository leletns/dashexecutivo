/**
 * Webhook do Dropbox — sincroniza em TEMPO REAL quando a planilha muda.
 *
 * Fluxo de configuração (uma vez, no painel do app Dropbox → Webhooks):
 *   URI: https://SEU-APP.vercel.app/api/webhooks/dropbox
 *   O Dropbox faz um GET com ?challenge=... para validar a URL (respondemos
 *   ecoando o challenge). Depois, a cada mudança na pasta, faz um POST.
 *
 * Segurança: se DROPBOX_APP_SECRET estiver definido, validamos a assinatura
 * HMAC-SHA256 do corpo (cabeçalho X-Dropbox-Signature). Sem o segredo, o
 * disparo ainda funciona, mas apenas re-lê a planilha da própria pasta do
 * cliente (operação idempotente, sem entrada de dados externa).
 *
 * Debounce: se uma sincronização começou nos últimos 120s, respondemos 200
 * sem re-sincronizar — assim as retentativas do Dropbox não geram retrabalho.
 */

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isDropboxConfigured } from "@/lib/dropbox";
import { runDropboxSync, DropboxSyncError } from "@/lib/dropbox-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEBOUNCE_MS = 120_000;

// ── GET — verificação da URL pelo Dropbox ──────────────────────────────────────
export async function GET(req: Request) {
  const challenge = new URL(req.url).searchParams.get("challenge") ?? "";
  return new NextResponse(challenge, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// ── POST — notificação de mudança ──────────────────────────────────────────────
export async function POST(req: Request) {
  const raw = await req.text();

  // Validação de assinatura (quando o segredo do app estiver configurado)
  const appSecret = process.env.DROPBOX_APP_SECRET;
  if (appSecret) {
    const signature = req.headers.get("x-dropbox-signature") ?? "";
    const expected = createHmac("sha256", appSecret).update(raw).digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "Assinatura inválida." }, { status: 403 });
    }
  }

  if (!isDropboxConfigured()) {
    // Sempre respondemos 200 para o Dropbox não desativar o webhook.
    return NextResponse.json({ ok: false, skipped: "dropbox_nao_configurado" });
  }

  const sb = createSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false, skipped: "banco_nao_configurado" });

  // Debounce: evita re-sincronizar se já rodou há pouco (retentativas do Dropbox).
  const desde = new Date(Date.now() - DEBOUNCE_MS).toISOString();
  const { data: recente } = await sb
    .from("portal_sheets_sync_log")
    .select("id, started_at")
    .like("triggered_by", "dropbox%")
    .gte("started_at", desde)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recente) {
    return NextResponse.json({ ok: true, skipped: "sincronizado_recentemente" });
  }

  try {
    const result = await runDropboxSync(sb, "dropbox:webhook");
    return NextResponse.json(result);
  } catch (err) {
    const e = err as DropboxSyncError;
    // Ainda respondemos 200 para o Dropbox não marcar o webhook como quebrado;
    // o erro fica registrado no log de sincronização.
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro na sincronização." });
  }
}
