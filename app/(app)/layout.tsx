import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/auth-server";
import { getPortalSectorFromEmail } from "@/lib/portal-sector";
import { AppShell } from "./app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSession();
  const email = session?.user?.email;
  if (!email) {
    redirect("/");
  }
  const sector = getPortalSectorFromEmail(email);
  return (
    <AppShell portal={{ sector, email }}>{children}</AppShell>
  );
}
