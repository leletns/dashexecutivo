import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDataForms } from "@/components/baps/admin-data-forms";
import { getPortalSession } from "@/lib/auth-server";
import { getPortalSectorFromEmail } from "@/lib/portal-sector";

export const metadata: Metadata = {
  title: "Admin · dados",
  description: "Formulários restritos para alimentação Supabase (Poliana & Miguel).",
};

export default async function AdminPage() {
  const session = await getPortalSession();
  const sector = getPortalSectorFromEmail(session?.user?.email);
  if (sector !== "executivo") {
    redirect("/dashboard");
  }
  return <AdminDataForms />;
}
