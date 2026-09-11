/**
 * Cálculo compartilhado do fluxo financeiro — a MESMA lógica usada por
 * GET /api/lancamentos/fluxo, extraída aqui para poder ser chamada também
 * DIRETO no servidor (sem round-trip HTTP) ao renderizar a página /financeiro
 * pela primeira vez — assim os dados já chegam prontos no primeiro HTML,
 * sem o usuário ver a tela vazia enquanto o navegador busca os dados.
 */

import { todayBrasilia } from "@/lib/timezone";
import { getLancamentos } from "@/lib/lancamentos-sheet";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getSnapshotMeta } from "@/lib/base-snapshot";

const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export interface FluxoFinanceiroParams {
  ano?: string;
  from?: string;
  to?: string;
}

export interface FluxoFinanceiroResult {
  fonte: string | null;
  aviso: string | null;
  fluxo_mensal: Array<{ mes: string; chave: string; entradas: number; saidas: number; saldo: number; acumulado: number }>;
  por_evento: Array<{
    nome: string;
    Receita: number;
    Despesa: number;
    resultado: number;
    receita_realizada: number;
    despesa_realizada: number;
    resultado_realizado: number;
  }>;
  por_conta: Array<{ nome: string; saldo: number }>;
  por_categoria: Array<{ nome: string; Receita: number; Despesa: number; resultado: number }>;
  saldo_planilha: { saldo_dia: number | null; saldo_projetado: number | null; atualizado_em: string | null } | null;
  totais: {
    total_receitas_pagas: number;
    total_despesas_pagas: number;
    saldo_realizado: number;
    resultado_projetado: number;
    total_a_receber: number;
    total_a_pagar: number;
    count_total: number;
  };
}

/**
 * Classifica o lançamento no fluxo operacional EXATAMENTE como a planilha:
 * pelo campo "Tratativa". Só "Receitas" e "Despesas" entram no fluxo —
 * TRANSFERÊNCIAS entre contas e EMPRÉSTIMOS ficam de fora (são movimentos
 * internos, não receita/despesa; incluí-los inflava os totais em ~R$ 22 mi
 * de cada lado, embora o saldo líquido não mudasse). Sem Tratativa clara,
 * cai no Rec./Desp. como reserva.
 */
function tipoFluxo(row: { tratativa?: string | null; rec_desp?: string | null }): "receita" | "despesa" | null {
  const t = (row.tratativa ?? "").toLowerCase().trim();
  if (t === "receitas") return "receita";
  if (t === "despesas") return "despesa";
  if (t.startsWith("transfer") || t.startsWith("emprést") || t.startsWith("emprest")) return null;
  const rd = (row.rec_desp ?? "").toLowerCase().trim();
  if (rd === "receitas") return "receita";
  if (rd === "despesas") return "despesa";
  return null;
}

export async function computeFluxoFinanceiro(params: FluxoFinanceiroParams): Promise<FluxoFinanceiroResult> {
  const ano = params.ano?.trim() ?? "";
  const from = params.from?.trim() ?? "";
  const to = params.to?.trim() ?? "";
  const today = todayBrasilia();

  const periodoAtivo = Boolean(ano || from || to);
  function dentroPeriodo(date: string | null | undefined): boolean {
    if (!periodoAtivo) return true;
    if (!date) return false;
    if (ano && date.slice(0, 4) !== ano) return false;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }

  const { rows: lancamentos, fonte, aviso: avisoFonteInicial } = await getLancamentos();
  let avisoFonte = avisoFonteInicial;
  if (fonte === "supabase" && lancamentos.length === 0) {
    avisoFonte = (avisoFonte ? avisoFonte + " " : "") +
      "Os dados salvos também estão vazios — é necessário rodar a sincronização ao menos uma vez.";
  }

  // ── 1. Fluxo mensal (lançamentos realizados, com data_pagamento) ──────────
  let totalEntradas = 0;
  let totalSaidas = 0;
  let countRealizados = 0;
  const fluxoMap = new Map<string, { entradas: number; saidas: number }>();

  for (const row of lancamentos) {
    const sit = (row.situacao ?? "").toLowerCase().trim();
    if (sit !== "recebido" && sit !== "pago") continue;
    if (!row.data_pagamento) continue;
    if (!dentroPeriodo(row.data_pagamento)) continue;

    const tipo = tipoFluxo(row);
    if (!tipo) continue;

    countRealizados += 1;
    const val = Number(row.valor) || 0;
    const key = row.data_pagamento.slice(0, 7);
    const cur = fluxoMap.get(key) ?? { entradas: 0, saidas: 0 };

    if (tipo === "receita") {
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
  let aReceber = 0;
  let aPagar = 0;
  for (const row of lancamentos) {
    if (!dentroPeriodo(row.data_vencimento)) continue;

    const sit = (row.situacao ?? "").toLowerCase().trim();
    const tipo = tipoFluxo(row);
    const val = Number(row.valor) || 0;
    if (sit === "a receber" && tipo === "receita") aReceber += val;
    else if (sit === "a pagar" && tipo === "despesa") aPagar += val;
  }

  // ── 3. Por evento ─────────────────────────────────────────────────────────
  const eventoMap = new Map<string, { receita: number; despesa: number; receitaReal: number; despesaReal: number }>();
  for (const row of lancamentos) {
    if (!row.evento) continue;

    const tipo = tipoFluxo(row);
    if (!tipo) continue;
    const cur = eventoMap.get(row.evento) ?? { receita: 0, despesa: 0, receitaReal: 0, despesaReal: 0 };
    const val = Number(row.valor) || 0;
    const sit = (row.situacao ?? "").toLowerCase().trim();
    const realizado = (sit === "recebido" || sit === "pago") && !!row.data_pagamento;
    if (tipo === "receita") {
      cur.receita += val;
      if (realizado) cur.receitaReal += val;
    } else {
      cur.despesa += val;
      if (realizado) cur.despesaReal += val;
    }
    eventoMap.set(row.evento, cur);
  }

  const por_evento = Array.from(eventoMap.entries())
    .map(([nome, { receita, despesa, receitaReal, despesaReal }]) => ({
      nome,
      Receita: receita,
      Despesa: despesa,
      resultado: receita - despesa,
      receita_realizada: receitaReal,
      despesa_realizada: despesaReal,
      resultado_realizado: receitaReal - despesaReal,
    }))
    .sort((a, b) => b.Receita - a.Receita)
    .slice(0, 60);

  // ── 4. Saldo por conta (caixa/banco) ──────────────────────────────────────
  const contaMap = new Map<string, number>();
  for (const row of lancamentos) {
    if (!row.conta_caixa) continue;
    const sit = (row.situacao ?? "").toLowerCase().trim();
    if (sit !== "recebido" && sit !== "pago") continue;
    if (!row.data_pagamento) continue;

    const rd = (row.rec_desp ?? "").toLowerCase().trim();
    const val = Number(row.valor) || 0;
    const sinal = rd === "receitas" ? val : -val;
    contaMap.set(row.conta_caixa, (contaMap.get(row.conta_caixa) ?? 0) + sinal);
  }

  const por_conta = Array.from(contaMap.entries())
    .map(([nome, saldo]) => ({ nome, saldo }))
    .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));

  // ── 5. Por categoria (Classificação de Contas) ────────────────────────────
  const categoriaMap = new Map<string, { receita: number; despesa: number }>();
  for (const row of lancamentos) {
    if (!row.classificacao) continue;
    if (!dentroPeriodo(row.data_vencimento)) continue;

    const tipo = tipoFluxo(row);
    if (!tipo) continue;
    const cur = categoriaMap.get(row.classificacao) ?? { receita: 0, despesa: 0 };
    if (tipo === "receita") cur.receita += Number(row.valor) || 0;
    else cur.despesa += Number(row.valor) || 0;
    categoriaMap.set(row.classificacao, cur);
  }

  const por_categoria = Array.from(categoriaMap.entries())
    .map(([nome, { receita, despesa }]) => ({
      nome,
      Receita: receita,
      Despesa: despesa,
      resultado: receita - despesa,
    }))
    .sort((a, b) => (b.Receita + b.Despesa) - (a.Receita + a.Despesa))
    .slice(0, 40);

  // ── Diagnóstico: dados existem mas tudo deu zero ──────────────────────────
  if (
    !avisoFonte &&
    lancamentos.length > 0 &&
    totalEntradas === 0 && totalSaidas === 0 && aReceber === 0 && aPagar === 0
  ) {
    const noAno = ano
      ? lancamentos.filter(
          (r) =>
            r.data_pagamento?.slice(0, 4) === ano ||
            r.data_vencimento?.slice(0, 4) === ano
        ).length
      : lancamentos.length;

    if (ano && noAno === 0) {
      avisoFonte = `Existem ${lancamentos.length.toLocaleString("pt-BR")} lançamentos na fonte de dados, mas nenhum corresponde ao ano ${ano}. Tente "Todos" para ver o período completo.`;
    } else if (ano) {
      avisoFonte = `Existem ${noAno.toLocaleString("pt-BR")} lançamentos do ano ${ano} na fonte de dados, mas nenhum tem situação "Recebido/Pago" com data de pagamento já efetivada (até ${today}) nem "A receber/A pagar" com vencimento em ${ano} — por isso os totais aparecem zerados.`;
    } else {
      avisoFonte = `Existem ${lancamentos.length.toLocaleString("pt-BR")} lançamentos na fonte de dados, mas nenhum tem situação "Recebido/Pago" com data de pagamento já efetivada — por isso os totais aparecem zerados.`;
    }
  }

  let saldoPlanilha: { saldo_dia: number | null; saldo_projetado: number | null; atualizado_em: string | null } | null = null;
  try {
    const sb = createSupabaseAdmin();
    if (sb) {
      const { data } = await sb
        .from("portal_planilha_resumo")
        .select("saldo_dia, saldo_projetado, atualizado_em")
        .eq("id", 1)
        .maybeSingle();
      if (data) {
        saldoPlanilha = {
          saldo_dia: data.saldo_dia !== null ? Number(data.saldo_dia) : null,
          saldo_projetado: data.saldo_projetado !== null ? Number(data.saldo_projetado) : null,
          atualizado_em: data.atualizado_em ?? null,
        };
      }
    }
  } catch {
    /* resumo é complementar */
  }

  if (fonte === "snapshot" && (!saldoPlanilha || saldoPlanilha.saldo_dia === null)) {
    const meta = getSnapshotMeta();
    if (meta.saldo_dia !== null) {
      saldoPlanilha = {
        saldo_dia: meta.saldo_dia,
        saldo_projetado: meta.saldo_projetado,
        atualizado_em: meta.relatorio_em ?? meta.gerado_em ?? null,
      };
    }
  }

  if (saldoPlanilha && saldoPlanilha.saldo_dia !== null && saldoPlanilha.saldo_projetado === null) {
    saldoPlanilha.saldo_projetado =
      Math.round((saldoPlanilha.saldo_dia + aReceber - aPagar) * 100) / 100;
  }

  return {
    fonte,
    aviso: avisoFonte,
    fluxo_mensal,
    por_evento,
    por_conta,
    por_categoria,
    saldo_planilha: saldoPlanilha,
    totais: {
      total_receitas_pagas: totalEntradas,
      total_despesas_pagas: totalSaidas,
      saldo_realizado: totalEntradas - totalSaidas,
      resultado_projetado: totalEntradas - totalSaidas + aReceber - aPagar,
      total_a_receber: aReceber,
      total_a_pagar: aPagar,
      count_total: countRealizados,
    },
  };
}
