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

// ---------------------------------------------------------------------------
// Seeds demonstrativos (premium, sem cara de placeholder)
// ---------------------------------------------------------------------------

const CORES_LOTE = [
  "hsl(var(--brand-3))",
  "hsl(var(--brand-1))",
  "hsl(var(--brand-2))",
  "rgb(16,185,129)",
];

const SEED_EDICOES: Edicao[] = [
  {
    slug: "edicao-1",
    nome: "1ª edição anual",
    cidade: "São Paulo · Centro de convenções Aurora",
    data: "12 a 16 de março de 2026",
    capacidade: 2500,
    patrocinio: 480000,
    custoProducao: 320000,
    lotes: [
      { nome: "Pista", preco: 290, vendidos: 1180, estoque: 420, cor: CORES_LOTE[0] },
      { nome: "Premium", preco: 490, vendidos: 540, estoque: 180, cor: CORES_LOTE[1] },
      { nome: "VIP", preco: 980, vendidos: 210, estoque: 90, cor: CORES_LOTE[2] },
      { nome: "Camarote executivo", preco: 1800, vendidos: 60, estoque: 30, cor: CORES_LOTE[3] },
    ],
  },
  {
    slug: "edicao-2",
    nome: "2ª edição anual",
    cidade: "Rio de Janeiro · Marina da Glória",
    data: "18 a 22 de junho de 2026",
    capacidade: 3200,
    patrocinio: 640000,
    custoProducao: 410000,
    lotes: [
      { nome: "Pista", preco: 320, vendidos: 1340, estoque: 660, cor: CORES_LOTE[0] },
      { nome: "Premium", preco: 540, vendidos: 480, estoque: 320, cor: CORES_LOTE[1] },
      { nome: "VIP", preco: 1080, vendidos: 240, estoque: 110, cor: CORES_LOTE[2] },
      { nome: "Camarote executivo", preco: 2100, vendidos: 40, estoque: 50, cor: CORES_LOTE[3] },
    ],
  },
  {
    slug: "edicao-3",
    nome: "3ª edição anual",
    cidade: "Belo Horizonte · Expominas",
    data: "10 a 14 de setembro de 2026",
    capacidade: 2800,
    patrocinio: 520000,
    custoProducao: 360000,
    lotes: [
      { nome: "Pista", preco: 280, vendidos: 720, estoque: 1080, cor: CORES_LOTE[0] },
      { nome: "Premium", preco: 460, vendidos: 220, estoque: 480, cor: CORES_LOTE[1] },
      { nome: "VIP", preco: 940, vendidos: 80, estoque: 180, cor: CORES_LOTE[2] },
      { nome: "Camarote executivo", preco: 1700, vendidos: 12, estoque: 38, cor: CORES_LOTE[3] },
    ],
  },
  {
    slug: "edicao-4",
    nome: "4ª edição anual",
    cidade: "Brasília · Centro de eventos Brasil 21",
    data: "26 a 29 de novembro de 2026",
    capacidade: 2200,
    patrocinio: 460000,
    custoProducao: 290000,
    lotes: [
      { nome: "Pista", preco: 310, vendidos: 320, estoque: 1080, cor: CORES_LOTE[0] },
      { nome: "Premium", preco: 520, vendidos: 90, estoque: 410, cor: CORES_LOTE[1] },
      { nome: "VIP", preco: 1020, vendidos: 30, estoque: 160, cor: CORES_LOTE[2] },
      { nome: "Camarote executivo", preco: 1900, vendidos: 4, estoque: 36, cor: CORES_LOTE[3] },
    ],
  },
];

// Lançamentos dos últimos 90 dias + próximos 60 dias para parecer um sistema vivo
function buildSeedFinanceiro(): FinanceLancamento[] {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const offset = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return iso(d);
  };

  const lanc = (
    id: string,
    tipo: "receita" | "despesa",
    descricao: string,
    categoria: FinanceCategoria,
    valor: number,
    venc: string,
    pago: string | null,
    edicao?: string,
  ): FinanceLancamento => ({
    id,
    tipo,
    descricao,
    categoria,
    valor,
    vencimento: venc,
    pagamento: pago,
    edicaoSlug: edicao ?? null,
  });

  return [
    // Receitas confirmadas
    lanc("r1", "receita", "Patrocínio Aurora · NF 2034", "Patrocínio", 145000, offset(-22), offset(-22), "edicao-1"),
    lanc("r2", "receita", "Patrocínio Vega · NF 2041", "Patrocínio", 98000, offset(-12), offset(-12), "edicao-1"),
    lanc("r3", "receita", "Lote Pista · 1ª edição (semana 4)", "Ingressos", 86200, offset(-18), offset(-18), "edicao-1"),
    lanc("r4", "receita", "Lote VIP · 1ª edição (lote 1)", "Ingressos", 142400, offset(-30), offset(-30), "edicao-1"),
    lanc("r5", "receita", "Patrocínio Helios · NF 2057", "Patrocínio", 210000, offset(-6), offset(-6), "edicao-2"),
    lanc("r6", "receita", "Pacote corporativo Banco Avellar", "Ingressos", 85000, offset(-3), offset(-3), "edicao-2"),

    // Receitas em aberto (a receber)
    lanc("r7", "receita", "Patrocínio Lumen · NF 2071", "Patrocínio", 180000, offset(8), null, "edicao-2"),
    lanc("r8", "receita", "Lote Premium · 1ª edição (lote 2)", "Ingressos", 132300, offset(15), null, "edicao-1"),
    lanc("r9", "receita", "Patrocínio Norte Atlântico · NF 2078", "Patrocínio", 240000, offset(28), null, "edicao-2"),
    lanc("r10", "receita", "Pacote ativações · Marca Sereia", "Patrocínio", 96000, offset(40), null, "edicao-3"),
    lanc("r11", "receita", "Camarotes executivos · 2ª edição", "Ingressos", 168000, offset(45), null, "edicao-2"),

    // Despesas pagas
    lanc("d1", "despesa", "Locação espaço · 1ª edição", "Locação", 38000, offset(-25), offset(-25), "edicao-1"),
    lanc("d2", "despesa", "Equipe técnica · evento 1", "Equipe", 22400, offset(-19), offset(-19), "edicao-1"),
    lanc("d3", "despesa", "Mídia paga · agosto", "Marketing", 14750, offset(-9), offset(-9)),
    lanc("d4", "despesa", "Catering staff · workshop", "Catering", 6800, offset(-7), offset(-7)),
    lanc("d5", "despesa", "Folha mensal · administrativo", "Equipe", 78000, offset(-5), offset(-5)),

    // Despesas em aberto (a pagar)
    lanc("d6", "despesa", "Locação espaço · 2ª edição (sinal)", "Locação", 64000, offset(6), null, "edicao-2"),
    lanc("d7", "despesa", "Mídia paga · campanha 2ª edição", "Marketing", 32000, offset(10), null, "edicao-2"),
    lanc("d8", "despesa", "Equipe técnica · pré-produção", "Equipe", 18500, offset(13), null, "edicao-2"),
    lanc("d9", "despesa", "Impostos sobre serviço · agosto", "Impostos", 21800, offset(2), null),
    lanc("d10", "despesa", "Energia + internet escritório", "Operação", 4900, offset(4), null),
    lanc("d11", "despesa", "Folha mensal · administrativo", "Equipe", 78000, offset(25), null),
    lanc("d12", "despesa", "Catering · ativação patrocinador", "Catering", 12400, offset(31), null, "edicao-2"),
    lanc("d13", "despesa", "Locação espaço · 3ª edição (reserva)", "Locação", 90000, offset(48), null, "edicao-3"),
  ];
}

const SEED_STATE: AppState = {
  edicoes: SEED_EDICOES,
  financeiro: buildSeedFinanceiro(),
};

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const STORAGE_KEY = "portal.appstate.v1";

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
  const [state, setState] = React.useState<AppState>(SEED_STATE);
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

  const resetState = React.useCallback(() => setState(SEED_STATE), []);

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
