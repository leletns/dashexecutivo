import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { createClient } from "@supabase/supabase-js";
import { resolveAuthSecret } from "@/lib/auth-secret";

// Credenciais PÚBLICAS do Supabase (a "anon key" é feita para ser pública —
// ela já é enviada ao navegador em todo acesso e o RLS é quem protege os
// dados). Servem de rede de segurança: se a variável de ambiente do Vercel
// estiver ausente ou desatualizada, o login continua funcionando.
const SUPABASE_URL_FALLBACK = "https://tckkdpwcsyicgiojkrlh.supabase.co";
const SUPABASE_ANON_KEY_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRja2tkcHdjc3lpY2dpb2prcmxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODEwNzgsImV4cCI6MjA5MzY1NzA3OH0.FbZPYn6v2IfbJCpFC-VYig-a3FBILTvj-sO9jBQpKMo";

function normalizeSupabaseUrl(u: string): string {
  return u.replace(/\/(rest|auth)(\/.*)?$/, "").replace(/\/$/, "");
}

function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/\d+/g, "").replace(/[._-]+/g, " ").trim();
  if (!cleaned) return email;
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export const authOptions = {
  trustHost: true,
  secret: resolveAuthSecret(),
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },
  pages: {
    signIn: "/",
    error: "/auth/error",
  },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "E-mail corporativo",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const emailRaw = credentials?.email?.trim().toLowerCase();
        const passwordRaw = credentials?.password;
        if (!emailRaw || typeof passwordRaw !== "string" || !passwordRaw) return null;

        const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
        const envKey =
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

        // Conexões a tentar: primeiro a do ambiente (Vercel) e, se ela não
        // existir ou falhar, a pública embutida como rede de segurança. Assim
        // o login funciona mesmo se a variável do Vercel estiver ausente ou
        // desatualizada — que é a causa mais comum de "senha incorreta" mesmo
        // com a senha certa.
        const connections: Array<{ url: string; key: string }> = [];
        if (envUrl && envKey) {
          connections.push({ url: normalizeSupabaseUrl(envUrl), key: envKey });
        }
        const fallbackUrl = normalizeSupabaseUrl(SUPABASE_URL_FALLBACK);
        if (
          !connections.some(
            (c) => c.url === fallbackUrl && c.key === SUPABASE_ANON_KEY_FALLBACK,
          )
        ) {
          connections.push({ url: fallbackUrl, key: SUPABASE_ANON_KEY_FALLBACK });
        }

        // Copiar/colar a senha quase sempre traz caracteres invisíveis grudados
        // nas pontas (espaço, quebra de linha, NBSP, zero-width). Tentamos a
        // senha exatamente como veio e, se o login falhar, tentamos uma versão
        // com as pontas limpas — assim colar a senha nunca mais quebra o acesso.
        const zeroWidth = "\\u200B-\\u200D\\uFEFF";
        const cleaned = passwordRaw
          .replace(new RegExp(`^[\\s${zeroWidth}]+`, "u"), "")
          .replace(new RegExp(`[\\s${zeroWidth}]+$`, "u"), "");
        const passwords =
          cleaned && cleaned !== passwordRaw ? [passwordRaw, cleaned] : [passwordRaw];

        let lastError: { message: string; status?: number } | null = null;
        for (const conn of connections) {
          const supabase = createClient(conn.url, conn.key);
          for (const password of passwords) {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: emailRaw,
              password,
            });
            if (!error && data.user) {
              return {
                id: emailRaw,
                email: emailRaw,
                name: displayNameFromEmail(emailRaw),
              };
            }
            lastError = error ?? lastError;
          }
        }

        if (lastError) {
          console.error("[auth] supabase signIn error:", lastError.message, lastError.status);
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async signIn({ account }) {
      if (account?.provider === "credentials") return true;
      return false;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email.trim().toLowerCase();
        token.name = user.name ?? displayNameFromEmail(user.email);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.name = (token.name as string) ?? session.user.name;
      }
      return session;
    },
  },
} as NextAuthOptions;
