import type { Metadata } from "next";
import { loadBapsSnapshot } from "@/lib/baps/load-snapshot";
import { BapsDashboard } from "@/components/baps/baps-dashboard";
import { getPortalSession } from "@/lib/auth-server";
import { getPortalSectorFromEmail } from "@/lib/portal-sector";

export const metadata: Metadata = {
  title: "Painel principal",
  description:
    "Visão geral da organização — financeiro, jurídico e operacional.",
};

export default async function DashboardPage() {
  const initial = await loadBapsSnapshot();
  const session = await getPortalSession();
  const sector = getPortalSectorFromEmail(session?.user?.email);
  return <BapsDashboard initial={initial} sector={sector} />;
}
