import { createHmac, timingSafeEqual } from "crypto";

import { PORTAL_LOGIN_EMAIL_SET } from "@/lib/portal-accounts";

/** Nome do cookie httpOnly da sessão (não alterar sem migrar clientes). */
export const PORTAL_SESSION_COOKIE = "portal_session";

/** Duração da sessão em segundos (7 dias). */
export const PORTAL_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

/**
 * Senha única nesta implantação (todos os e-mails acima).
 * Em produção, prefira IdP ou variável de ambiente.
 */
const PORTAL_PASSWORD = "Usuario@2026";

function authSecret(): string {
  return (
    process.env.PORTAL_AUTH_SECRET ||
    "portal-dev-secret-defina-PORTAL_AUTH_SECRET-em-producao"
  );
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function verifyPortalCredentials(email: string, password: string): boolean {
  const e = normalizeEmail(email);
  if (!PORTAL_LOGIN_EMAIL_SET.has(e)) return false;
  const a = Buffer.from(password, "utf8");
  const b = Buffer.from(PORTAL_PASSWORD, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function signPortalSession(email: string): string {
  const e = normalizeEmail(email);
  if (!PORTAL_LOGIN_EMAIL_SET.has(e)) {
    throw new Error("E-mail não autorizado para sessão");
  }
  const exp = Date.now() + PORTAL_SESSION_MAX_AGE_SEC * 1000;
  const payload = Buffer.from(JSON.stringify({ e, exp }), "utf8").toString("base64url");
  const sig = createHmac("sha256", authSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyPortalSessionCookie(
  cookieValue: string | undefined,
): { email: string } | null {
  if (!cookieValue) return null;
  const lastDot = cookieValue.lastIndexOf(".");
  if (lastDot <= 0) return null;
  const payloadB64 = cookieValue.slice(0, lastDot);
  const sig = cookieValue.slice(lastDot + 1);
  const expectedSig = createHmac("sha256", authSecret()).update(payloadB64).digest("base64url");
  if (sig.length !== expectedSig.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expectedSig, "utf8"))) {
      return null;
    }
  } catch {
    return null;
  }
  let data: { e?: string; exp?: number };
  try {
    data = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!data.e || typeof data.exp !== "number") return null;
  if (Date.now() > data.exp) return null;
  const e = normalizeEmail(data.e);
  if (!PORTAL_LOGIN_EMAIL_SET.has(e)) return null;
  return { email: e };
}
