import type { Metadata } from "next";
import { todayBrasilia } from "@/lib/timezone";
import { periodoParams, type Periodo } from "@/lib/periodo-financeiro";
import { computeFluxoFinanceiro } from "@/lib/fluxo-financeiro";
import { FinanceiroPageClient } from "./financeiro-client";

export const metadata: Metadata = {
  title: "Financeiro",
  description: "Fluxo de caixa, eventos e indicadores financeiros do BAPS.",
};

// Página busca os dados do período padrão DIRETO no servidor (mesma função
// usada por /api/lancamentos/fluxo, sem round-trip HTTP) — assim a tela já
// chega pronta no primeiro HTML, sem o usuário ver o painel vazio enquanto o
// navegador faz a primeira busca.
export default async function FinanceiroPage() {
  const initialPeriodo: Periodo = { ano: todayBrasilia().slice(0, 4), mes: -1 };

  // Sequencial (não Promise.all) de propósito: a 1ª chamada popula o cache de
  // 45s de lib/lancamentos-sheet.ts (que pagina ~56 mil linhas do Supabase);
  // a 2ª reaproveita esse cache e só roda a agregação em memória — rodando em
  // paralelo, as duas disparariam a paginação pesada ao mesmo tempo.
  const initialFluxo = await computeFluxoFinanceiro(periodoParams(initialPeriodo)).catch(() => undefined);
  const initialFluxoTodoPeriodo = await computeFluxoFinanceiro({}).catch(() => undefined);

  return (
    <FinanceiroPageClient
      initialPeriodo={initialPeriodo}
      initialFluxo={initialFluxo}
      initialFluxoTodoPeriodo={initialFluxoTodoPeriodo}
    />
  );
}
