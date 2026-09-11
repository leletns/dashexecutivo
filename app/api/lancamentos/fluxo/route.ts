/**
 * GET /api/lancamentos/fluxo
 *
 * Fina camada HTTP sobre `computeFluxoFinanceiro` (lib/fluxo-financeiro.ts) —
 * a mesma função é chamada direto no servidor ao renderizar /financeiro pela
 * primeira vez, sem round-trip HTTP (carregamento inicial mais ágil).
 *
 * Fonte de dados: Supabase (sincronizado do Dropbox) com fallback para o
 * retrato embutido e, por último, a planilha pública do Google — ver
 * lib/lancamentos-sheet.ts.
 */

import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/auth-server";
import { computeFluxoFinanceiro } from "@/lib/fluxo-financeiro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const result = await computeFluxoFinanceiro({
      ano: searchParams.get("ano") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}
