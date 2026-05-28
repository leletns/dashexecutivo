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

export async function GET(_req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const sb = createSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });

    // Fluxo mensal — apenas lançamentos liquidados com data de pagamento
    const { data: pagamentos } = await sb
      .from("portal_lancamentos")
      .select("rec_desp, situacao, valor, data_pagamento")
      .not("data_pagamento", "is", null)
      .in("situacao", ["Recebido", "Pago"]);

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
        const [ano, mesNum] = key.split("-");
        const label = `${MESES_PT[Number(mesNum) - 1] ?? mesNum}/${(ano ?? "").slice(2)}`;
        return { mes: label, chave: key, entradas, saidas, saldo, acumulado };
      });

    // Por evento — todas as movimentações com evento informado
    const { data: eventos } = await sb
      .from("portal_lancamentos")
      .select("evento, rec_desp, valor")
      .not("evento", "is", null)
      .neq("evento", "");

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

    return NextResponse.json({ fluxo_mensal, por_evento });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}
