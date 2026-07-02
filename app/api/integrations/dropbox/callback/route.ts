/**
 * GET /api/integrations/dropbox/callback
 *
 * Callback do OAuth do Dropbox — troca o código pelo refresh token permanente
 * e mostra numa página simples o valor para copiar em DROPBOX_REFRESH_TOKEN
 * (Vercel → Environment Variables). Depois disso a sincronização nunca mais
 * expira.
 *
 * Acesso restrito a: financeiro, executivo.
 */

import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/auth-server";
import { getPortalSectorFromEmail } from "@/lib/portal-sector";
import { exchangeCodeForRefreshToken } from "@/lib/dropbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WRITE_SECTORS = new Set(["financeiro", "executivo"]);
const STATE_COOKIE = "dropbox_oauth_state";

function page(title: string, bodyHtml: string): NextResponse {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f6f6f7;color:#18181b;margin:0;padding:24px;display:flex;justify-content:center}
  .card{background:#fff;border:1px solid #e4e4e7;border-radius:16px;max-width:560px;width:100%;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
  h1{font-size:19px;margin:0 0 8px}
  p{font-size:14px;line-height:1.55;color:#52525b}
  code,.token{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}
  .token{display:block;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:10px;padding:12px;margin:14px 0;word-break:break-all;user-select:all}
  ol{font-size:14px;line-height:1.7;color:#3f3f46;padding-left:20px}
  .ok{color:#15803d;font-weight:600}
  .err{color:#b91c1c;font-weight:600}
</style></head><body><div class="card">${bodyHtml}</div></body></html>`;
  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const portal = await requirePortalSession();
  if (!portal) return page("Sessão expirada", `<h1 class="err">Sessão expirada</h1><p>Faça login no painel e tente conectar novamente.</p>`);

  const sector = getPortalSectorFromEmail((portal as any).email ?? "");
  if (!WRITE_SECTORS.has(sector)) return page("Sem permissão", `<h1 class="err">Sem permissão</h1>`);

  const err = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (err) return page("Erro", `<h1 class="err">Não foi possível conectar</h1><p>${err}</p>`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${STATE_COOKIE}=`))
    ?.split("=")[1];

  if (!code) return page("Erro", `<h1 class="err">Código ausente</h1><p>Tente conectar novamente.</p>`);
  if (!state || !cookieState || state !== cookieState) {
    return page("Erro", `<h1 class="err">Falha de validação</h1><p>Tente conectar novamente pelo botão do painel.</p>`);
  }

  try {
    const redirectUri = `${url.origin}/api/integrations/dropbox/callback`;
    const tokens = await exchangeCodeForRefreshToken(code, redirectUri);
    if (!tokens.refresh_token) {
      return page("Erro", `<h1 class="err">Sem refresh token</h1><p>O Dropbox não retornou um refresh token. Verifique se o app está em modo "offline".</p>`);
    }
    return page(
      "Conectado ao Dropbox",
      `<h1 class="ok">✓ Conectado ao Dropbox</h1>
       <p>Copie o código abaixo e cole no Vercel como a variável
       <code>DROPBOX_REFRESH_TOKEN</code>. Depois de salvar, faça um novo deploy —
       e a sincronização <b>nunca mais vai expirar</b>.</p>
       <span class="token">${tokens.refresh_token}</span>
       <ol>
         <li>Vercel → seu projeto → <b>Settings → Environment Variables</b>.</li>
         <li>Crie <code>DROPBOX_REFRESH_TOKEN</code> com o valor acima.</li>
         <li>Confirme que <code>DROPBOX_APP_KEY</code> e <code>DROPBOX_APP_SECRET</code> também estão lá.</li>
         <li>Salve e clique em <b>Redeploy</b>.</li>
       </ol>
       <p>Pode fechar esta página depois de copiar.</p>`,
    );
  } catch (e: any) {
    return page("Erro", `<h1 class="err">Falha ao conectar</h1><p>${e?.message ?? "Erro desconhecido."}</p>`);
  }
}
