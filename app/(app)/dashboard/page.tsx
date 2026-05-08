import type { Metadata } from "next";
import { loadBapsSnapshot } from "@/lib/baps/load-snapshot";
import { BapsDashboard } from "@/components/baps/baps-dashboard";
import { getPortalSession } from "@/lib/auth-server";
import { getPortalSectorFromEmail } from "@/lib/portal-sector";

export const metadata: Metadata = {
  title: "Dash executivo",
  description:
    "Painel executivo · governança jurídica, financeira e operacional.",
};

export default async function DashboardPage() {
  const initial = await loadBapsSnapshot();
  const session = await getPortalSession();
  const sector = getPortalSectorFromEmail(session?.user?.email);
  return <BapsDashboard initial={initial} sector={sector} />;
}
