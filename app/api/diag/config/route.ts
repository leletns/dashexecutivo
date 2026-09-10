/**
 * GET /api/diag/config
 *
 * Diagnóstico de configuração da PRODUÇÃO — informa apenas se cada variável
 * de ambiente ESTÁ presente (true/false), NUNCA o valor (nada de segredos).
 * Também mostra de qual fonte o painel está lendo os dados agora e quantos
 * lançamentos/eventos vieram — para explicar em segundos por que "não bate".
 *
 * Acesso restrito a setores de escrita (financeiro, executivo, tesouraria).
 */

import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/auth-server";
import { getPortalSectorFromEmail, WRITE_SECTORS } from "@/lib/portal-sector";
import { getLancamentos } from "@/lib/lancamentos-sheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const has = (v: string | undefined | null): boolean => !!(v && v.trim());

export async function GET() {
  const portal = await requirePortalSession();
  if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const sector = getPortalSectorFromEmail((portal as any).email ?? "");
  if (!WRITE_SECTORS.has(sector)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const env = {
    NEXT_PUBLIC_SUPABASE_URL: has(process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_URL: has(process.env.SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: has(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_ANON_KEY: has(process.env.SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: has(process.env.SUPABASE_SERVICE_ROLE_KEY),
    DROPBOX_SHARED_LINK_URL: has(process.env.DROPBOX_SHARED_LINK_URL),
    DROPBOX_REFRESH_TOKEN: has(process.env.DROPBOX_REFRESH_TOKEN),
    DROPBOX_APP_KEY: has(process.env.DROPBOX_APP_KEY),
    DROPBOX_APP_SECRET: has(process.env.DROPBOX_APP_SECRET),
    CRON_SECRET: has(process.env.CRON_SECRET),
  };

  let fonte: string | null = null;
  let totalRows = 0;
  let aviso: string | null = null;
  try {
    const r = await getLancamentos();
    fonte = r.fonte;
    totalRows = r.rows.length;
    aviso = r.aviso;
  } catch (e: any) {
    aviso = `erro ao ler lançamentos: ${e?.message ?? e}`;
  }

  return NextResponse.json({
    env,
    dados: { fonte, totalRows, aviso },
    diagnostico: {
      sync_pode_rodar:
        env.SUPABASE_SERVICE_ROLE_KEY &&
        (env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL) &&
        (env.DROPBOX_SHARED_LINK_URL || env.DROPBOX_REFRESH_TOKEN),
      falta_service_role: !env.SUPABASE_SERVICE_ROLE_KEY,
      falta_dropbox_link: !env.DROPBOX_SHARED_LINK_URL,
    },
    checado_em: new Date().toISOString(),
  });
}
