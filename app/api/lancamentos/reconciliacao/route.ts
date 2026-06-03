/**
 * GET /api/lancamentos/reconciliacao
 *
 * Retorna totais agrupados por (situacao, rec_desp) para conferência
 * com a planilha do e-Gestor.
 */

import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/auth-server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITUACAO_ORDER = ["Recebido", "Pago", "A receber", "A pagar"];

export async function GET(_req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const sb = createSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });

    // Fetch all rows (just the fields we need — fast query)
    const { data, error } = await sb
      .from("portal_lancamentos")
      .select("situacao, rec_desp, valor");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Aggregate by (situacao, rec_desp)
    const map = new Map<string, { count: number; total: number; rec_desp: string }>();

    for (const row of data ?? []) {
      const situacao = row.situacao ?? "Sem situação";
      const rec_desp = row.rec_desp ?? "Indefinido";
      const key = `${situacao}::${rec_desp}`;
      const cur = map.get(key) ?? { count: 0, total: 0, rec_desp };
      cur.count += 1;
      cur.total += Number(row.valor) || 0;
      map.set(key, cur);
    }

    const result = Array.from(map.entries())
      .map(([key, val]) => ({
        situacao: key.split("::")[0],
        rec_desp: val.rec_desp,
        count: val.count,
        total: val.total,
      }))
      .sort((a, b) => {
        const ai = SITUACAO_ORDER.indexOf(a.situacao);
        const bi = SITUACAO_ORDER.indexOf(b.situacao);
        if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        return a.rec_desp.localeCompare(b.rec_desp);
      });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}
