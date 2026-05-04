/** E-mails autorizados a entrar no portal (mesmo domínio, um por área + CEO). */
export const PORTAL_LOGIN_EMAILS = [
  "ludymilla@portal.com",
  "juridico@portal.com",
  "contabil@portal.com",
  "marketing@portal.com",
  "administrativo@portal.com",
  "financeiro@portal.com",
  "eventos@portal.com",
] as const;

export const PORTAL_LOGIN_EMAIL_SET = new Set<string>(
  PORTAL_LOGIN_EMAILS.map((e) => e.toLowerCase()),
);
