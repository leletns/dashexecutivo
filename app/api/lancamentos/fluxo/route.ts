/**
 * GET /api/lancamentos/fluxo
 *
 * Agrega portal_lancamentos em:
 *  - fluxo_mensal: entradas/saídas/saldo/acumulado por mês (data_pagamento)
 *  - por_evento: receita/despesa/resultado por nome do evento
 */

import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/auth-server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export async function GET(req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const sb = createSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });

    const { searchParams } = new URL(req.url);
    const ano = searchParams.get("ano")?.trim() ?? "";
    const today = new Date().toISOString().slice(0, 10);

    // Fluxo mensal — só pagamentos já realizados até hoje (nunca meses futuros)
    let fluxoQuery = sb
      .from("portal_lancamentos")
      .select("rec_desp, situacao, valor, data_pagamento")
      .not("data_pagamento", "is", null)
      .in("situacao", ["Recebido", "Pago"])
      .lte("data_pagamento", today);
    if (ano) {
      fluxoQuery = fluxoQuery
        .gte("data_pagamento", `${ano}-01-01`)
        .lte("data_pagamento", `${ano}-12-31`);
    }
    const { data: pagamentos } = await fluxoQuery;

    const fluxoMap = new Map<string, { entradas: number; saidas: number }>();
    for (const row of pagamentos ?? []) {
      const key = (row.data_pagamento as string).slice(0, 7);
      const cur = fluxoMap.get(key) ?? { entradas: 0, saidas: 0 };
      if (row.rec_desp === "Receitas") cur.entradas += Number(row.valor) || 0;
      else cur.saidas += Number(row.valor) || 0;
      fluxoMap.set(key, cur);
    }

    let acumulado = 0;
    const fluxo_mensal = Array.from(fluxoMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, { entradas, saidas }]) => {
        const saldo = entradas - saidas;
        acumulado += saldo;
        const [anoK, mesNum] = key.split("-");
        const label = `${MESES_PT[Number(mesNum) - 1] ?? mesNum}/${(anoK ?? "").slice(2)}`;
        return { mes: label, chave: key, entradas, saidas, saldo, acumulado };
      });

    // Totais do período (para KPIs)
    const totalEntradas = fluxo_mensal.reduce((s, r) => s + r.entradas, 0);
    const totalSaidas = fluxo_mensal.reduce((s, r) => s + r.saidas, 0);

    // Por evento — filtrado pelo mesmo ano quando aplicável
    let evQuery = sb
      .from("portal_lancamentos")
      .select("evento, rec_desp, valor")
      .not("evento", "is", null)
      .neq("evento", "");
    if (ano) {
      evQuery = evQuery
        .gte("data_vencimento", `${ano}-01-01`)
        .lte("data_vencimento", `${ano}-12-31`);
    }
    const { data: eventos } = await evQuery;

    const eventoMap = new Map<string, { receita: number; despesa: number }>();
    for (const row of eventos ?? []) {
      if (!row.evento) continue;
      const cur = eventoMap.get(row.evento) ?? { receita: 0, despesa: 0 };
      if (row.rec_desp === "Receitas") cur.receita += Number(row.valor) || 0;
      else cur.despesa += Number(row.valor) || 0;
      eventoMap.set(row.evento, cur);
    }

    const por_evento = Array.from(eventoMap.entries())
      .map(([nome, { receita, despesa }]) => ({
        nome,
        Receita: receita,
        Despesa: despesa,
        resultado: receita - despesa,
      }))
      .sort((a, b) => b.Receita - a.Receita)
      .slice(0, 12);

    // A receber / A pagar filtrados
    let pendentesQuery = sb
      .from("portal_lancamentos")
      .select("rec_desp, situacao, valor")
      .in("situacao", ["A receber", "A pagar"]);
    if (ano) {
      pendentesQuery = pendentesQuery
        .gte("data_vencimento", `${ano}-01-01`)
        .lte("data_vencimento", `${ano}-12-31`);
    }
    const { data: pendentes } = await pendentesQuery;

    let aReceber = 0;
    let aPagar = 0;
    for (const row of pendentes ?? []) {
      if (row.situacao === "A receber") aReceber += Number(row.valor) || 0;
      else aPagar += Number(row.valor) || 0;
    }

    return NextResponse.json({
      fluxo_mensal,
      por_evento,
      totais: {
        total_receitas_pagas: totalEntradas,
        total_despesas_pagas: totalSaidas,
        saldo_realizado: totalEntradas - totalSaidas,
        resultado_projetado: totalEntradas - totalSaidas + aReceber - aPagar,
        total_a_receber: aReceber,
        total_a_pagar: aPagar,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}
