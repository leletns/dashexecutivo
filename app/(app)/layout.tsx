import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  PORTAL_SESSION_COOKIE,
  verifyPortalSessionCookie,
} from "@/lib/portal-auth-server";
import { AppShell } from "./app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get(PORTAL_SESSION_COOKIE)?.value;
  if (!verifyPortalSessionCookie(token)) {
    redirect("/");
  }
  return <AppShell>{children}</AppShell>;
}
