"use client";

import * as React from "react";

// ---------------------------------------------------------------------------
// Modelos de domínio
// ---------------------------------------------------------------------------

export type Lote = {
  nome: string;
  preco: number;
  vendidos: number;
  estoque: number;
  cor: string;
};

export type Edicao = {
  slug: string;
  nome: string;
  cidade: string;
  data: string;
  capacidade: number;
  patrocinio: number;
  custoProducao: number;
  lotes: Lote[];
};

export type FinanceCategoria =
  | "Patrocínio"
  | "Ingressos"
  | "Locação"
  | "Marketing"
  | "Equipe"
  | "Catering"
  | "Operação"
  | "Impostos"
  | "Outros";

export type FinanceLancamento = {
  id: string;
  tipo: "receita" | "despesa";
  descricao: string;
  categoria: FinanceCategoria;
  valor: number; // sempre positivo
  vencimento: string; // ISO yyyy-mm-dd
  pagamento: string | null; // ISO ou null se em aberto
  edicaoSlug?: string | null;
  recorrente?: boolean;
};

export type AppState = {
  edicoes: Edicao[];
  financeiro: FinanceLancamento[];
};

/** Estado inicial sem dados de demonstração — pronto para dados reais (API ou preenchimento manual). */
export const EMPTY_APP_STATE: AppState = {
  edicoes: [],
  financeiro: [],
};

const CORES_LOTE = [
  "hsl(var(--brand-3))",
  "hsl(var(--brand-1))",
  "hsl(var(--brand-2))",
  "rgb(16,185,129)",
];

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/** v2: separa armazenamento de versões antigas que continham dados de demonstração. */
const STORAGE_KEY = "portal.appstate.v2";

function readStorage(): AppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || !Array.isArray(parsed.edicoes) || !Array.isArray(parsed.financeiro)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(state: AppState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignora quotas
  }
}

// ---------------------------------------------------------------------------
// Contexto + actions
// ---------------------------------------------------------------------------

export type EdicaoPatch = Partial<Omit<Edicao, "slug" | "lotes">>;
export type LotePatch = Partial<Lote>;

type Ctx = {
  state: AppState;
  hydrated: boolean;
  // Edições
  upsertEdicao: (edicao: Edicao) => void;
  patchEdicao: (slug: string, patch: EdicaoPatch) => void;
  removeEdicao: (slug: string) => void;
  duplicateEdicao: (slug: string) => Edicao | null;
  patchLote: (slug: string, idx: number, patch: LotePatch) => void;
  addLote: (slug: string) => void;
  removeLote: (slug: string, idx: number) => void;
  // Financeiro
  addLancamento: (l: Omit<FinanceLancamento, "id">) => FinanceLancamento;
  patchLancamento: (id: string, patch: Partial<FinanceLancamento>) => void;
  togglePago: (id: string, pago: boolean) => void;
  removeLancamento: (id: string) => void;
  // Bulk
  applyAppStatePatch: (patch: Partial<AppState>) => void;
  resetState: () => void;
};

const AppStateContext = React.createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AppState>(EMPTY_APP_STATE);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    const persisted = readStorage();
    if (persisted) {
      setState(persisted);
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (hydrated) writeStorage(state);
  }, [state, hydrated]);

  const upsertEdicao = React.useCallback((edicao: Edicao) => {
    setState((prev) => {
      const exists = prev.edicoes.some((e) => e.slug === edicao.slug);
      const edicoes = exists
        ? prev.edicoes.map((e) => (e.slug === edicao.slug ? edicao : e))
        : [...prev.edicoes, edicao];
      return { ...prev, edicoes };
    });
  }, []);

  const patchEdicao = React.useCallback((slug: string, patch: EdicaoPatch) => {
    setState((prev) => ({
      ...prev,
      edicoes: prev.edicoes.map((e) => (e.slug === slug ? { ...e, ...patch } : e)),
    }));
  }, []);

  const removeEdicao = React.useCallback((slug: string) => {
    setState((prev) => ({
      ...prev,
      edicoes: prev.edicoes.filter((e) => e.slug !== slug),
      financeiro: prev.financeiro.map((f) =>
        f.edicaoSlug === slug ? { ...f, edicaoSlug: null } : f,
      ),
    }));
  }, []);

  const duplicateEdicao = React.useCallback((slug: string): Edicao | null => {
    const found = state.edicoes.find((e) => e.slug === slug);
    if (!found) return null;
    const novo: Edicao = {
      ...found,
      slug: nextEdicaoSlug(state.edicoes),
      nome: `${found.nome} (cópia)`,
      lotes: found.lotes.map((l) => ({ ...l })),
    };
    upsertEdicao(novo);
    return novo;
  }, [state.edicoes, upsertEdicao]);

  const patchLote = React.useCallback((slug: string, idx: number, patch: LotePatch) => {
    setState((prev) => ({
      ...prev,
      edicoes: prev.edicoes.map((e) =>
        e.slug !== slug
          ? e
          : { ...e, lotes: e.lotes.map((l, i) => (i === idx ? { ...l, ...patch } : l)) },
      ),
    }));
  }, []);

  const addLote = React.useCallback((slug: string) => {
    setState((prev) => ({
      ...prev,
      edicoes: prev.edicoes.map((e) => {
        if (e.slug !== slug) return e;
        const novo: Lote = {
          nome: `Lote ${e.lotes.length + 1}`,
          preco: 0,
          vendidos: 0,
          estoque: 0,
          cor: CORES_LOTE[e.lotes.length % CORES_LOTE.length],
        };
        return { ...e, lotes: [...e.lotes, novo] };
      }),
    }));
  }, []);

  const removeLote = React.useCallback((slug: string, idx: number) => {
    setState((prev) => ({
      ...prev,
      edicoes: prev.edicoes.map((e) =>
        e.slug !== slug ? e : { ...e, lotes: e.lotes.filter((_, i) => i !== idx) },
      ),
    }));
  }, []);

  const addLancamento = React.useCallback(
    (l: Omit<FinanceLancamento, "id">) => {
      const novo: FinanceLancamento = { ...l, id: cryptoId() };
      setState((prev) => ({ ...prev, financeiro: [novo, ...prev.financeiro] }));
      return novo;
    },
    [],
  );

  const patchLancamento = React.useCallback(
    (id: string, patch: Partial<FinanceLancamento>) => {
      setState((prev) => ({
        ...prev,
        financeiro: prev.financeiro.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      }));
    },
    [],
  );

  const togglePago = React.useCallback((id: string, pago: boolean) => {
    setState((prev) => ({
      ...prev,
      financeiro: prev.financeiro.map((f) =>
        f.id === id
          ? { ...f, pagamento: pago ? f.pagamento ?? new Date().toISOString().slice(0, 10) : null }
          : f,
      ),
    }));
  }, []);

  const removeLancamento = React.useCallback((id: string) => {
    setState((prev) => ({ ...prev, financeiro: prev.financeiro.filter((f) => f.id !== id) }));
  }, []);

  const applyAppStatePatch = React.useCallback((patch: Partial<AppState>) => {
    setState((prev) => ({
      edicoes: patch.edicoes ?? prev.edicoes,
      financeiro: patch.financeiro ?? prev.financeiro,
    }));
  }, []);

  const resetState = React.useCallback(() => setState(EMPTY_APP_STATE), []);

  const value: Ctx = {
    state,
    hydrated,
    upsertEdicao,
    patchEdicao,
    removeEdicao,
    duplicateEdicao,
    patchLote,
    addLote,
    removeLote,
    addLancamento,
    patchLancamento,
    togglePago,
    removeLancamento,
    applyAppStatePatch,
    resetState,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = React.useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState deve estar dentro de AppStateProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function nextEdicaoSlug(edicoes: Edicao[]): string {
  const usados = new Set(edicoes.map((e) => e.slug));
  let i = edicoes.length + 1;
  while (usados.has(`edicao-${i}`)) i += 1;
  return `edicao-${i}`;
}

function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function corPadraoLote(idx: number): string {
  return CORES_LOTE[idx % CORES_LOTE.length];
}

// Métricas derivadas reaproveitadas em várias telas
export function metricasEdicao(ed: Edicao) {
  const totalVendidos = ed.lotes.reduce((acc, l) => acc + l.vendidos, 0);
  const ocupacao = ed.capacidade > 0 ? Math.round((totalVendidos / ed.capacidade) * 100) : 0;
  const receitaIngressos = ed.lotes.reduce((acc, l) => acc + l.preco * l.vendidos, 0);
  const receitaTotal = receitaIngressos + ed.patrocinio;
  const margemValor = receitaTotal - ed.custoProducao;
  const margemPct = receitaTotal > 0 ? Math.round((margemValor / receitaTotal) * 100) : 0;
  return { totalVendidos, ocupacao, receitaIngressos, receitaTotal, margemValor, margemPct };
}
