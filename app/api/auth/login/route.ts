import { NextResponse } from "next/server";
import {
  PORTAL_SESSION_COOKIE,
  PORTAL_SESSION_MAX_AGE_SEC,
  signPortalSession,
  verifyPortalCredentials,
} from "@/lib/portal-auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo inválido." }, { status: 400 });
  }
  const email =
    typeof (body as { email?: unknown })?.email === "string"
      ? (body as { email: string }).email
      : "";
  const password =
    typeof (body as { password?: unknown })?.password === "string"
      ? (body as { password: string }).password
      : "";

  if (!email.trim() || !password) {
    return NextResponse.json(
      { ok: false, error: "Informe e-mail e senha." },
      { status: 400 },
    );
  }

  if (!verifyPortalCredentials(email, password)) {
    return NextResponse.json(
      { ok: false, error: "E-mail ou senha incorretos." },
      { status: 401 },
    );
  }

  let token: string;
  try {
    token = signPortalSession(email);
  } catch {
    return NextResponse.json({ ok: false, error: "Falha ao criar sessão." }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(PORTAL_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PORTAL_SESSION_MAX_AGE_SEC,
  });
  return res;
}
