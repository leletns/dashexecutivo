/**
 * Modelo de período compartilhado pelas telas financeiras (Financeiro, Contábil
 * e afins). Um único lugar para a lógica de "Até o mês atual / mês / ano".
 *
 *   mes = -1  → "Até o mês atual" (acumulado do ano até o mês corrente) — é o
 *               fluxo de caixa até agora, base para bater com a planilha.
 *   mes =  0  → ano inteiro
 *   mes 1-12  → mês específico
 */

import { todayBrasilia } from "@/lib/timezone";

export type Periodo = { ano: string; mes: number };

export const MESES_LONGO = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Fim do intervalo "até o mês atual" para um dado ano (ano passado = ano inteiro). */
export function fimAteMesAtual(ano: string): string {
  const hoje = todayBrasilia(); // YYYY-MM-DD (Brasília)
  if (ano !== hoje.slice(0, 4)) return `${ano}-12-31`;
  const mesAtual = Number(hoje.slice(5, 7));
  const ultimo = new Date(Number(ano), mesAtual, 0).getDate();
  return `${ano}-${String(mesAtual).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`;
}

/** Converte o período em parâmetros de query (?ano OU ?from&to). */
export function periodoParams(p: Periodo): Record<string, string> {
  if (!p.ano) return {};
  if (p.mes === -1) return { from: `${p.ano}-01-01`, to: fimAteMesAtual(p.ano) };
  if (p.mes > 0) {
    const mm = String(p.mes).padStart(2, "0");
    const ultimoDia = new Date(Number(p.ano), p.mes, 0).getDate();
    return { from: `${p.ano}-${mm}-01`, to: `${p.ano}-${mm}-${String(ultimoDia).padStart(2, "0")}` };
  }
  return { ano: p.ano };
}

export function periodoQuery(p: Periodo): string {
  const qs = new URLSearchParams(periodoParams(p)).toString();
  return qs ? `?${qs}` : "";
}

/** Rótulo do período para exibição. */
export function periodoLabel(p: Periodo): string {
  if (!p.ano) return "Todos os períodos";
  if (p.mes === -1) return `Até o mês atual · ${p.ano}`;
  if (p.mes > 0) return `${MESES_LONGO[p.mes - 1]}/${p.ano}`;
  return p.ano;
}

/** Sufixo " — <label>" para títulos, vazio quando é "Todos". */
export function periodoSufixo(p: Periodo): string {
  if (!p.ano) return "";
  if (p.mes === -1) return ` — até ${MESES_LONGO[Number(fimAteMesAtual(p.ano).slice(5, 7)) - 1]}/${p.ano}`;
  if (p.mes > 0) return ` — ${MESES_LONGO[p.mes - 1]}/${p.ano}`;
  return ` — ${p.ano}`;
}

/** Opções do seletor de mês (inclui "Até o mês atual" e "Ano todo"). */
export function mesSelectOptions(): { value: string; label: string }[] {
  return [
    { value: "-1", label: "Até o mês atual" },
    { value: "0", label: "Ano todo" },
    ...MESES_LONGO.map((m, i) => ({ value: String(i + 1), label: m })),
  ];
}
