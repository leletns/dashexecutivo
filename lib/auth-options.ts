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
        const password = credentials?.password;
        if (!emailRaw || typeof password !== "string" || !password) return null;

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) return null;

        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailRaw,
          password,
        });
        if (error || !data.user) return null;

        return {
          id: emailRaw,
          email: emailRaw,
          name: displayNameFromEmail(emailRaw),
        };
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
