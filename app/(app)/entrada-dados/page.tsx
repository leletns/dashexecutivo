import type { Metadata } from "next";
import { EntradaDadosClient } from "@/components/baps/entrada-dados-client";
import { getPortalSession } from "@/lib/auth-server";
import { getPortalSectorFromEmail } from "@/lib/portal-sector";

export const metadata: Metadata = {
  title: "Entrada de dados",
  description: "Formulários para alimentar o Dash executivo.",
};

export default async function EntradaDadosPage() {
  const session = await getPortalSession();
  const sector = getPortalSectorFromEmail(session?.user?.email);
  return <EntradaDadosClient sector={sector} />;
}
