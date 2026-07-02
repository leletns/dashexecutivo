/**
 * GET /api/integrations/dropbox/connect
 *
 * Inicia o fluxo OAuth do Dropbox com acesso OFFLINE — o retorno traz um
 * refresh token permanente (não expira), que resolve de vez o problema do
 * token de 4h. Redireciona para a tela de autorização do Dropbox.
 *
 * Pré-requisito: DROPBOX_APP_KEY e DROPBOX_APP_SECRET configurados no Vercel,
 * e este endereço de callback registrado no app Dropbox (OAuth2 → Redirect URIs).
 *
 * Acesso restrito a: financeiro, executivo.
 */

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requirePortalSession } from "@/lib/auth-server";
import { getPortalSectorFromEmail } from "@/lib/portal-sector";
import { buildDropboxAuthorizeUrl, hasDropboxAppCredentials } from "@/lib/dropbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WRITE_SECTORS = new Set(["financeiro", "executivo"]);
const STATE_COOKIE = "dropbox_oauth_state";

export async function GET(req: Request) {
  const portal = await requirePortalSession();
  if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const sector = getPortalSectorFromEmail((portal as any).email ?? "");
  if (!WRITE_SECTORS.has(sector)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  if (!hasDropboxAppCredentials()) {
    return NextResponse.json(
      {
        error:
          "Configure primeiro DROPBOX_APP_KEY e DROPBOX_APP_SECRET nas variáveis " +
          "de ambiente do Vercel (encontram-se no painel do app Dropbox → Settings).",
      },
      { status: 503 },
    );
  }

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/integrations/dropbox/callback`;
  const state = randomBytes(16).toString("hex");

  const res = NextResponse.redirect(buildDropboxAuthorizeUrl(redirectUri, state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
