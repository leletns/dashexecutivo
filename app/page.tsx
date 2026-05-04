import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  PORTAL_SESSION_COOKIE,
  verifyPortalSessionCookie,
} from "@/lib/portal-auth-server";
import { LoginPageClient } from "@/components/auth/login-page-client";

export default function HomePage() {
  if (verifyPortalSessionCookie(cookies().get(PORTAL_SESSION_COOKIE)?.value)) {
    redirect("/dashboard");
  }
  return <LoginPageClient />;
}
