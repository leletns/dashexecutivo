/**
 * Segredo JWT compartilhado entre API NextAuth e middleware (Edge).
 * Se NEXTAUTH_SECRET não existir no .env, usa fallback estável para não bloquear o acesso.
 * Em ambiente exposto na internet, defina sempre NEXTAUTH_SECRET próprio.
 */
export const AUTH_SECRET_FALLBACK =
  "portal-executivo-sessao-interna-padrao-defina-nextauth-secret-em-producao";

export function resolveAuthSecret(): string {
  const env = process.env.NEXTAUTH_SECRET?.trim();
  if (env) return env;
  return AUTH_SECRET_FALLBACK;
}
