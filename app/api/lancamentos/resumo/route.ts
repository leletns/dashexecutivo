/**
 * GET /api/lancamentos/resumo
 *
 * KPIs e agrupamentos agregados dos lançamentos sincronizados.
 * Retorna totais por situação, por rec_desp e top eventos.
 */

import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/auth-server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const sb = createSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });

    // Totais gerais
    const { data: totais } = await sb.rpc("lancamentos_totais");

    // Top 15 eventos por valor total de receita
    const { data: topEventos } = await sb
      .from("portal_lancamentos")
      .select("evento, rec_desp, valor")
      .not("evento", "is", null)
      .eq("rec_desp", "Receitas")
      .order("valor", { ascending: false });

    // Agrupa por evento
    const eventoMap = new Map<string, number>();
    for (const row of topEventos ?? []) {
      if (!row.evento) continue;
      eventoMap.set(row.evento, (eventoMap.get(row.evento) ?? 0) + (row.valor ?? 0));
    }
    const eventosSorted = Array.from(eventoMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([nome, total]) => ({ nome, total }));

    // Contas únicas
    const { data: contas } = await sb
      .from("portal_lancamentos")
      .select("conta_caixa")
      .not("conta_caixa", "is", null);

    const contasUnicas = [...new Set((contas ?? []).map((r) => r.conta_caixa))].sort();

    // Situações únicas
    const { data: situacoes } = await sb
      .from("portal_lancamentos")
      .select("situacao")
      .not("situacao", "is", null);

    const situacoesUnicas = [...new Set((situacoes ?? []).map((r) => r.situacao))].sort();

    // Eventos únicos
    const eventosList = Array.from(eventoMap.keys()).sort();

    return NextResponse.json({
      totais: totais ?? null,
      top_eventos: eventosSorted,
      contas_unicas: contasUnicas,
      situacoes_unicas: situacoesUnicas,
      eventos_lista: eventosList,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}
