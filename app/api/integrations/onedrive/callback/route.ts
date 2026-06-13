/**
 * GET /api/integrations/onedrive/callback
 *
 * Callback do fluxo OAuth2 da Microsoft — troca o "code" pelos tokens de
 * acesso/refresh e os salva em portal_integration_tokens.
 */

import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/auth-server";
import { getPortalSectorFromEmail } from "@/lib/portal-sector";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { exchangeCodeForTokens, fetchAccountLabel, storeTokens } from "@/lib/onedrive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WRITE_SECTORS = new Set(["financeiro", "executivo"]);
const STATE_COOKIE = "onedrive_oauth_state";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirectTo = (status: string, message?: string) => {
    const dest = new URL("/financeiro", url.origin);
    dest.searchParams.set("onedrive", status);
    if (message) dest.searchParams.set("onedrive_msg", message);
    return NextResponse.redirect(dest);
  };

  const portal = await requirePortalSession();
  if (!portal) return redirectTo("error", "Sessão expirada. Faça login novamente.");

  const sector = getPortalSectorFromEmail((portal as any).email ?? "");
  if (!WRITE_SECTORS.has(sector)) return redirectTo("error", "Sem permissão.");

  const error = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (error) return redirectTo("error", error);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${STATE_COOKIE}=`))
    ?.split("=")[1];

  if (!code) return redirectTo("error", "Código de autorização ausente.");
  if (!state || !cookieState || state !== cookieState) {
    return redirectTo("error", "Falha de validação do estado OAuth (tente novamente).");
  }

  const sb = createSupabaseAdmin();
  if (!sb) return redirectTo("error", "Banco não configurado.");

  try {
    const tokens = await exchangeCodeForTokens(code);
    const accountLabel = await fetchAccountLabel(tokens.access_token);
    await storeTokens(sb, tokens, accountLabel);
  } catch (err: any) {
    return redirectTo("error", err?.message ?? "Falha ao conectar com a Microsoft.");
  }

  const res = redirectTo("connected");
  res.cookies.set(STATE_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
