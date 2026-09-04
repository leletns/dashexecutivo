import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { createClient } from "@supabase/supabase-js";
import { resolveAuthSecret } from "@/lib/auth-secret";

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

        const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
        if (!rawUrl || !supabaseAnonKey) return null;
        const supabaseUrl = rawUrl.replace(/\/(rest|auth)(\/.*)?$/, "").replace(/\/$/, "");

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Copiar/colar a senha quase sempre traz caracteres invisíveis grudados
        // nas pontas (espaço, quebra de linha, NBSP, zero-width). Tentamos a
        // senha exatamente como veio e, se o login falhar, tentamos uma versão
        // com as pontas limpas — assim colar a senha nunca mais quebra o acesso.
        const zeroWidth = "\\u200B-\\u200D\\uFEFF";
        const cleaned = passwordRaw
          .replace(new RegExp(`^[\\s${zeroWidth}]+`, "u"), "")
          .replace(new RegExp(`[\\s${zeroWidth}]+$`, "u"), "");
        const candidates =
          cleaned && cleaned !== passwordRaw ? [passwordRaw, cleaned] : [passwordRaw];

        let lastError: { message: string; status?: number } | null = null;
        for (const password of candidates) {
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
