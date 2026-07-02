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
import { isDropboxConfigured } from "@/lib/dropbox";
import { runDropboxSync, DropboxSyncError } from "@/lib/dropbox-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  try {
    const result = await runDropboxSync(sb, "dropbox:cron");
    return NextResponse.json({ ...result, triggered_at: new Date().toISOString() });
  } catch (err) {
    const e = err as DropboxSyncError;
    return NextResponse.json({ error: e?.message ?? "Erro interno." }, { status: e?.status ?? 500 });
  }
}
