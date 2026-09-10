import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveSupabaseUrl, resolveSupabaseAnonKey } from "./public-config";

let _client: SupabaseClient | null = null;

/** Singleton browser Supabase client (anon key, safe for client-side). */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (_client) return _client;
  // URL/anon key do ambiente, com fallback público embutido.
  _client = createClient(resolveSupabaseUrl(), resolveSupabaseAnonKey());
  return _client;
}
