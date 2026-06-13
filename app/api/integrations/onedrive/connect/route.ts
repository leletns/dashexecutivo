/**
 * GET /api/integrations/onedrive/connect
 *
 * Inicia o fluxo OAuth2 com a Microsoft (OneDrive). Redireciona o usuário
 * para a tela de login/consentimento da Microsoft.
 *
 * Acesso restrito a setores: financeiro, executivo
 */

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requirePortalSession } from "@/lib/auth-server";
import { getPortalSectorFromEmail } from "@/lib/portal-sector";
import { buildAuthorizeUrl, isOneDriveConfigured } from "@/lib/onedrive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WRITE_SECTORS = new Set(["financeiro", "executivo"]);
const STATE_COOKIE = "onedrive_oauth_state";

export async function GET() {
  const portal = await requirePortalSession();
  if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const sector = getPortalSectorFromEmail((portal as any).email ?? "");
  if (!WRITE_SECTORS.has(sector)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  if (!isOneDriveConfigured()) {
    return NextResponse.json(
      {
        error:
          "Integração com OneDrive não configurada. Defina MICROSOFT_CLIENT_ID, " +
          "MICROSOFT_CLIENT_SECRET e MICROSOFT_REDIRECT_URI nas variáveis de ambiente.",
      },
      { status: 503 }
    );
  }

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthorizeUrl(state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
