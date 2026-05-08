import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function getPortalSession() {
  return getServerSession(authOptions);
}

export async function requirePortalSession() {
  const session = await getPortalSession();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return null;
  return { email, name: session?.user?.name ?? null };
}
