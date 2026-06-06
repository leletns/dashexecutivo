/**
 * GET /api/lancamentos/fluxo
 *
 * Agrega portal_lancamentos em:
 *  - fluxo_mensal: entradas/saídas/saldo/acumulado por mês (data_pagamento)
 *  - por_evento: receita/despesa/resultado por nome do evento
 *
 * Totais calculados 100% via JS (sem depender do RPC lancamentos_totais)
 * para funcionar mesmo com versão antiga da função no Supabase.
 */

import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/auth-server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { todayBrasilia } from "@/lib/timezone";

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
    const today = todayBrasilia();

    // ── 1. Lançamentos realizados (com data_pagamento) ────────────────────────
    // Filtra no JS por situacao para aceitar qualquer capitalização do e-Gestor
    let fluxoQuery = sb
      .from("portal_lancamentos")
      .select("rec_desp, situacao, valor, data_pagamento")
      .not("data_pagamento", "is", null)
      .lte("data_pagamento", today);
    if (ano) {
      fluxoQuery = fluxoQuery
        .gte("data_pagamento", `${ano}-01-01`)
        .lte("data_pagamento", `${ano}-12-31`);
    }
    const { data: pagamentos } = await fluxoQuery;

    let totalEntradas = 0;
    let totalSaidas = 0;
    const fluxoMap = new Map<string, { entradas: number; saidas: number }>();

    for (const row of pagamentos ?? []) {
      const sit = (row.situacao ?? "").toLowerCase().trim();
      if (sit !== "recebido" && sit !== "pago") continue;

      const rd  = (row.rec_desp ?? "").toLowerCase().trim();
      const val = Number(row.valor) || 0;
      const key = (row.data_pagamento as string).slice(0, 7);
      const cur = fluxoMap.get(key) ?? { entradas: 0, saidas: 0 };

      if (rd === "receitas") {
        cur.entradas += val;
        totalEntradas += val;
      } else {
        cur.saidas += val;
        totalSaidas += val;
      }
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

    // ── 2. Lançamentos pendentes (A receber / A pagar) ────────────────────────
    let pendentesQuery = sb
      .from("portal_lancamentos")
      .select("situacao, valor, data_vencimento");
    if (ano) {
      pendentesQuery = pendentesQuery
        .gte("data_vencimento", `${ano}-01-01`)
        .lte("data_vencimento", `${ano}-12-31`);
    }
    const { data: pendentes } = await pendentesQuery;

    let aReceber = 0;
    let aPagar   = 0;
    for (const row of pendentes ?? []) {
      const sit = (row.situacao ?? "").toLowerCase().trim();
      const val = Number(row.valor) || 0;
      if (sit === "a receber") aReceber += val;
      else if (sit === "a pagar") aPagar += val;
    }

    // ── 3. Por evento ─────────────────────────────────────────────────────────
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
      const rd  = (row.rec_desp ?? "").toLowerCase().trim();
      if (rd === "receitas") cur.receita += Number(row.valor) || 0;
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

    return NextResponse.json({
      fluxo_mensal,
      por_evento,
      totais: {
        total_receitas_pagas: totalEntradas,
        total_despesas_pagas: totalSaidas,
        saldo_realizado:      totalEntradas - totalSaidas,
        resultado_projetado:  totalEntradas - totalSaidas + aReceber - aPagar,
        total_a_receber:      aReceber,
        total_a_pagar:        aPagar,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}
