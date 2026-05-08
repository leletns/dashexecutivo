import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { resolveAuthSecret } from "@/lib/auth-secret";
import { PORTAL_LOGIN_EMAIL_SET } from "@/lib/portal-accounts";

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

function loadPasswordHashes(): Record<string, string> {
  const b64 = process.env.PORTAL_PASSWORD_HASHES_B64?.trim();
  const raw =
    b64 && typeof Buffer !== "undefined"
      ? Buffer.from(b64, "base64").toString("utf8")
      : process.env.PORTAL_PASSWORD_HASHES;
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, v]) => typeof v === "string" && (v as string).startsWith("$2"))
        .map(([k, v]) => [k.trim().toLowerCase(), v as string]),
    );
  } catch {
    return {};
  }
}

function isProvisionedEmail(email: string): boolean {
  return PORTAL_LOGIN_EMAIL_SET.has(email.trim().toLowerCase());
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
        if (!isProvisionedEmail(emailRaw)) return null;
        const hashes = loadPasswordHashes();
        const hash = hashes[emailRaw];
        if (!hash) return null;
        const ok = await bcrypt.compare(password, hash);
        if (!ok) return null;
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
