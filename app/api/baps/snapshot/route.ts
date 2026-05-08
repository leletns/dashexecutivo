import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/auth-server";
import { loadBapsSnapshot } from "@/lib/baps/load-snapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getPortalSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const snapshot = await loadBapsSnapshot();
  return NextResponse.json(snapshot);
}
