import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveSupabaseUrl } from "./public-config";

/**
 * Client "admin" (service role) — usado pela sincronização Dropbox→Supabase e
 * pela leitura dos lançamentos. A URL cai no fallback público se a variável do
 * Vercel faltar; a SERVICE ROLE KEY é secreta e vem SÓ do ambiente (sem ela,
 * retornamos null e o chamador trata o "banco não configurado").
 */
export function createSupabaseAdmin(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  const url = resolveSupabaseUrl();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
