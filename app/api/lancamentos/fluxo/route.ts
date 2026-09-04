/**
 * GET /api/lancamentos/fluxo
 *
 * Fonte de dados: lê DIRETO da planilha Google Sheets (aba e-Gestor) — sem
 * Google Cloud, sem conta de serviço. Basta a planilha estar publicada/
 * compartilhada como "Qualquer pessoa com o link pode ver"; o servidor busca
 * o export CSV público (GOOGLE_SHEETS_SPREADSHEET_ID + GOOGLE_SHEETS_SHEET_NAME).
 * Assim o painel mostra exatamente o que está na planilha — sem depender do
 * pipeline de sincronização (Apps Script → Supabase), que é a causa dos
 * números que não batiam.
 *
 * Fallback automático: se a planilha não estiver configurada/pública (ou a
 * leitura falhar), usa portal_lancamentos no Supabase — que continua
 * recebendo backup via Apps Script.
 *
 * Cache em memória de 45s para não sobrecarregar o Google Sheets a cada refresh.
 *
 * Agrega em:
 *  - fluxo_mensal: entradas/saídas/saldo/acumulado por mês (data_pagamento)
 *  - por_evento: receita/despesa/resultado por nome do evento
 *  - totais: receitas/despesas pagas, a receber/a pagar, saldo e resultado projetado
 */

import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/auth-server";
import { todayBrasilia } from "@/lib/timezone";
import { getLancamentos } from "@/lib/lancamentos-sheet";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

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

export async function GET(req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const ano = searchParams.get("ano")?.trim() ?? "";
    const from = searchParams.get("from")?.trim() ?? "";
    const to = searchParams.get("to")?.trim() ?? "";
    const today = todayBrasilia();

    // Filtro de período: aceita ano completo (ano=2026) OU intervalo de datas
    // (from=2026-01-01&to=2026-03-31), usado pelo seletor "todo o período /
    // este mês / trimestre / bimestre / ano" do painel principal. Sem nenhum
    // filtro ativo, mantém o comportamento original (todas as datas contam).
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
      // Conta tudo marcado como realizado (recebido/pago), independente da data
      // ser futura — é como a planilha calcula o caixa. Só exige ter data.
      if (!row.data_pagamento) continue;
      if (!dentroPeriodo(row.data_pagamento)) continue;

      const tipo = tipoFluxo(row);
      if (!tipo) continue; // transferências/empréstimos ficam fora do fluxo

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
    let aPagar   = 0;
    for (const row of lancamentos) {
      if (!dentroPeriodo(row.data_vencimento)) continue;

      const sit = (row.situacao ?? "").toLowerCase().trim();
      const tipo = tipoFluxo(row);
      const val = Number(row.valor) || 0;
      if (sit === "a receber" && tipo === "receita") aReceber += val;
      else if (sit === "a pagar" && tipo === "despesa") aPagar += val;
    }

    // ── 3. Por evento ─────────────────────────────────────────────────────────
    // Resultado ACUMULADO de cada evento (todo o ciclo de vida — NÃO é filtrado
    // pelo período), para bater com as abas de evento da planilha (que são o
    // P&L total do evento). Mostra o total lançado (inclui a receber/a pagar) +
    // o REALIZADO (só Recebido/Pago), como o financeiro pediu.
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
      // Mostra TODOS os eventos (antes limitava a 12, escondendo eventos reais);
      // teto alto só como proteção contra ruído.
      .slice(0, 60);

    // ── 4. Saldo por conta (caixa/banco) ──────────────────────────────────────
    // Saldo atual de cada conta — soma de tudo que já foi recebido/pago até hoje,
    // independente do filtro de ano (é o "extrato" de cada conta neste momento).
    const contaMap = new Map<string, number>();
    for (const row of lancamentos) {
      if (!row.conta_caixa) continue;
      const sit = (row.situacao ?? "").toLowerCase().trim();
      if (sit !== "recebido" && sit !== "pago") continue;
      if (!row.data_pagamento) continue;

      const rd  = (row.rec_desp ?? "").toLowerCase().trim();
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

    // ── Diagnóstico: dados existem mas tudo deu zero (provável filtro/ano sem match) ─
    if (
      !avisoFonte &&
      lancamentos.length > 0 &&
      totalEntradas === 0 && totalSaidas === 0 && aReceber === 0 && aPagar === 0
    ) {
      // Conta quantos lançamentos realmente caem no ano filtrado (por data de
      // pagamento OU vencimento) — sem isso a mensagem podia dizer "nenhum
      // corresponde ao ano X" mesmo quando existem lançamentos daquele ano que
      // só não bateram com os outros filtros (situação/data já efetivada).
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

    // Saldos-resumo controlados na própria planilha ("Saldo do Dia" /
    // "Saldo Projetado") — números manuais do financeiro, para o painel bater
    // exatamente com a planilha. Independem do filtro de período (é o retrato
    // atual do caixa).
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

    // Rede de segurança: se a captura do "Saldo Projetado" falhar (ex.: o
    // financeiro renomear a célula na planilha), derivamos um substituto são a
    // partir do Saldo do Dia — nunca exibir nulo/negativo sem sentido.
    if (saldoPlanilha && saldoPlanilha.saldo_dia !== null && saldoPlanilha.saldo_projetado === null) {
      saldoPlanilha.saldo_projetado =
        Math.round((saldoPlanilha.saldo_dia + aReceber - aPagar) * 100) / 100;
    }

    return NextResponse.json({
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
        saldo_realizado:      totalEntradas - totalSaidas,
        resultado_projetado:  totalEntradas - totalSaidas + aReceber - aPagar,
        total_a_receber:      aReceber,
        total_a_pagar:        aPagar,
        count_total:          countRealizados,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}
