import type { Metadata } from "next";
import { todayBrasilia } from "@/lib/timezone";
import { periodoParams, type Periodo } from "@/lib/periodo-financeiro";
import { computeFluxoFinanceiro, type FluxoFinanceiroResult } from "@/lib/fluxo-financeiro";
import { FinanceiroPageClient } from "./financeiro-client";

export const metadata: Metadata = {
  title: "Financeiro",
  description: "Fluxo de caixa, eventos e indicadores financeiros do BAPS.",
};

// Orçamento de tempo para a busca no servidor: no caminho feliz (cache
// quente ou Supabase respondendo bem) os dados chegam em ~1-3s e a tela já
// nasce pronta. Se demorar mais que isso (cache frio + Supabase lento), a
// página é entregue SEM os dados iniciais — o cliente busca normalmente
// (como sempre fez) em vez de deixar o usuário olhando para uma tela em
// branco por dezenas de segundos. Nunca pior que o comportamento antigo,
// só melhor quando a busca é rápida.
//
// O orçamento principal (KPIs do topo, o que mais importa) é mais generoso;
// o secundário (aba Análise, dado de apoio) é bem curto — ele só reaproveita
// o cache que a 1ª busca acabou de esquentar, então ou vem quase instantâneo
// ou não vale a pena esperar (o total nunca deve passar de ~4s).
const ORCAMENTO_PRINCIPAL_MS = 6500;
const ORCAMENTO_SECUNDARIO_MS = 1500;

function comOrcamento<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    promise.catch(() => undefined),
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms)),
  ]);
}

export default async function FinanceiroPage() {
  const initialPeriodo: Periodo = { ano: todayBrasilia().slice(0, 4), mes: -1 };

  // Sequencial (não Promise.all) de propósito: a 1ª chamada popula o cache de
  // 45s de lib/lancamentos-sheet.ts; a 2ª reaproveita esse cache e só roda a
  // agregação em memória (rápida) — por isso só a 1ª tem o orçamento cheio;
  // se ela não veio a tempo, nem tenta a 2ª (também não viria a tempo).
  const initialFluxo: FluxoFinanceiroResult | undefined = await comOrcamento(
    computeFluxoFinanceiro(periodoParams(initialPeriodo)),
    ORCAMENTO_PRINCIPAL_MS,
  );
  const initialFluxoTodoPeriodo: FluxoFinanceiroResult | undefined = initialFluxo
    ? await comOrcamento(computeFluxoFinanceiro({}), ORCAMENTO_SECUNDARIO_MS)
    : undefined;

  return (
    <FinanceiroPageClient
      initialPeriodo={initialPeriodo}
      initialFluxo={initialFluxo}
      initialFluxoTodoPeriodo={initialFluxoTodoPeriodo}
    />
  );
}
