/**
 * Configuração PÚBLICA do Supabase.
 *
 * A URL do projeto e a "anon key" NÃO são segredos — elas já são enviadas ao
 * navegador em todo acesso, e o RLS é quem protege os dados. Mantemos aqui um
 * fallback embutido para que o login e a leitura de dados continuem
 * funcionando mesmo se as variáveis de ambiente do Vercel estiverem ausentes
 * ou desatualizadas (causa raiz de "o painel não bate com a base": sem essas
 * variáveis, a sincronização Dropbox→Supabase não roda e o painel cai para a
 * planilha antiga).
 *
 * ATENÇÃO: a SUPABASE_SERVICE_ROLE_KEY é SECRETA (ignora o RLS) e NUNCA deve
 * ser embutida no código — ela vem exclusivamente de variável de ambiente.
 */

export const SUPABASE_URL_FALLBACK = "https://tckkdpwcsyicgiojkrlh.supabase.co";

export const SUPABASE_ANON_KEY_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRja2tkcHdjc3lpY2dpb2prcmxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODEwNzgsImV4cCI6MjA5MzY1NzA3OH0.FbZPYn6v2IfbJCpFC-VYig-a3FBILTvj-sO9jBQpKMo";

/** Remove sufixos (/rest, /auth) e barra final da URL do Supabase. */
export function normalizeSupabaseUrl(u: string): string {
  return u.replace(/\/(rest|auth)(\/.*)?$/, "").replace(/\/$/, "");
}

/** URL do Supabase: variável de ambiente, senão o fallback público embutido. */
export function resolveSupabaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    SUPABASE_URL_FALLBACK;
  return normalizeSupabaseUrl(raw);
}

/** Anon key do Supabase: variável de ambiente, senão o fallback público. */
export function resolveSupabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    SUPABASE_ANON_KEY_FALLBACK
  );
}
