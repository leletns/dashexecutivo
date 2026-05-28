import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseAdmin(): SupabaseClient | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl || !key) return null;
  // Remove sufixos /rest/v1 ou /auth que o usuário pode ter colado por engano
  const url = rawUrl.replace(/\/(rest|auth)(\/.*)?$/, "").replace(/\/$/, "");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
