"use client";

import * as React from "react";

export type IndicatorKey = "receita" | "despesa" | "lucro" | "ticket";

export type IndicatorCard = {
  key: IndicatorKey;
  label: string;
  value: number;
  format: "currency" | "number";
  hint?: string;
};

export type SeriesPoint = {
  month: string;
  receita: number;
  despesa: number;
  lucro: number;
};

export type Attachment = { name: string; size: number; type: string };

export type GlowVariant = "brand" | "emerald";

type Ctx = {
  cards: IndicatorCard[];
  series: SeriesPoint[];
  attachments: Record<IndicatorKey, Attachment[]>;
  glowing: boolean;
  glowToken: number;
  glowVariant: GlowVariant;
  triggerGlow: (variant?: GlowVariant) => void;
  setCardValue: (key: IndicatorKey, value: number) => void;
  applyImported: (
    data: Partial<{
      cards: Partial<Record<IndicatorKey, number>>;
      series: SeriesPoint[];
    }>,
    options?: { glow?: GlowVariant },
  ) => void;
  addAttachments: (key: IndicatorKey, files: File[]) => void;
  removeAttachment: (key: IndicatorKey, name: string) => void;
};

const DashboardContext = React.createContext<Ctx | null>(null);

const DASH_STORAGE_KEY = "portal.dashboard.v1";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Série mensal em zero — estrutura para preenchimento real (importação ou edição). */
export function emptySeries(): SeriesPoint[] {
  return MONTH_LABELS.map((month) => ({ month, receita: 0, despesa: 0, lucro: 0 }));
}

const INITIAL_CARDS: IndicatorCard[] = [
  { key: "receita", label: "Receita acumulada", value: 0, format: "currency", hint: "Consolidado do período" },
  { key: "despesa", label: "Despesas operacionais", value: 0, format: "currency", hint: "Custos consolidados" },
  { key: "lucro", label: "Lucro líquido", value: 0, format: "currency", hint: "Receita − despesas" },
  { key: "ticket", label: "Ticket médio por evento", value: 0, format: "currency", hint: "Média por evento" },
];

function readDashboardStorage(): { cards: IndicatorCard[]; series: SeriesPoint[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DASH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { cards?: IndicatorCard[]; series?: SeriesPoint[] };
    if (!parsed?.cards || !Array.isArray(parsed.cards) || !Array.isArray(parsed.series)) return null;
    return { cards: parsed.cards, series: parsed.series.length ? parsed.series : emptySeries() };
  } catch {
    return null;
  }
}

function writeDashboardStorage(cards: IndicatorCard[], series: SeriesPoint[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DASH_STORAGE_KEY, JSON.stringify({ cards, series }));
  } catch {
    // quota
  }
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [cards, setCards] = React.useState<IndicatorCard[]>(INITIAL_CARDS);
  const [series, setSeries] = React.useState<SeriesPoint[]>(emptySeries);
  const [hydrated, setHydrated] = React.useState(false);
  const [attachments, setAttachments] = React.useState<Record<IndicatorKey, Attachment[]>>({
    receita: [],
    despesa: [],
    lucro: [],
    ticket: [],
  });
  const [glowing, setGlowing] = React.useState(false);
  const [glowToken, setGlowToken] = React.useState(0);
  const [glowVariant, setGlowVariant] = React.useState<GlowVariant>("brand");
  const glowTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const saved = readDashboardStorage();
    if (saved) {
      setCards(saved.cards);
      setSeries(saved.series);
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    writeDashboardStorage(cards, series);
  }, [cards, series, hydrated]);

  const triggerGlow = React.useCallback((variant: GlowVariant = "brand") => {
    setGlowVariant(variant);
    setGlowing(true);
    setGlowToken((t) => t + 1);
    if (glowTimer.current) clearTimeout(glowTimer.current);
    glowTimer.current = setTimeout(() => setGlowing(false), 2000);
  }, []);

  React.useEffect(() => {
    return () => {
      if (glowTimer.current) clearTimeout(glowTimer.current);
    };
  }, []);

  const setCardValue = React.useCallback((key: IndicatorKey, value: number) => {
    setCards((prev) => prev.map((c) => (c.key === key ? { ...c, value } : c)));
    setSeries((prev) => recalcSeries(prev.length ? prev : emptySeries(), key, value));
  }, []);

  const applyImported = React.useCallback<Ctx["applyImported"]>(
    (data, options) => {
      if (data.cards) {
        setCards((prev) =>
          prev.map((c) =>
            data.cards && typeof data.cards[c.key] === "number"
              ? { ...c, value: data.cards[c.key] as number }
              : c,
          ),
        );
      }
      if (data.series && Array.isArray(data.series) && data.series.length > 0) {
        setSeries(data.series);
      } else if (data.cards) {
        setSeries((prev) => {
          const base = prev.length ? prev : emptySeries();
          let next = base;
          for (const k of Object.keys(data.cards!) as IndicatorKey[]) {
            const v = data.cards![k];
            if (typeof v === "number") next = recalcSeries(next, k, v);
          }
          return next;
        });
      }
      triggerGlow(options?.glow ?? "brand");
    },
    [triggerGlow],
  );

  const addAttachments = React.useCallback((key: IndicatorKey, files: File[]) => {
    setAttachments((prev) => ({
      ...prev,
      [key]: [
        ...prev[key],
        ...files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
      ],
    }));
  }, []);

  const removeAttachment = React.useCallback((key: IndicatorKey, name: string) => {
    setAttachments((prev) => ({
      ...prev,
      [key]: prev[key].filter((a) => a.name !== name),
    }));
  }, []);

  const value: Ctx = {
    cards,
    series,
    attachments,
    glowing,
    glowToken,
    glowVariant,
    triggerGlow,
    setCardValue,
    applyImported,
    addAttachments,
    removeAttachment,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboardContext() {
  const ctx = React.useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboardContext deve estar dentro de DashboardProvider");
  return ctx;
}

function recalcSeries(series: SeriesPoint[], key: IndicatorKey, value: number): SeriesPoint[] {
  if (key === "ticket") return series;
  if (!series.length) return emptySeries();
  const total = series.reduce((acc, p) => acc + (p[key as "receita" | "despesa" | "lucro"] ?? 0), 0);
  if (total <= 0) {
    const flat = value / series.length;
    return series.map((p) => ({ ...p, [key]: Math.round(flat) }) as SeriesPoint);
  }
  const factor = value / total;
  const next = series.map((p) => {
    const updated = { ...p } as SeriesPoint;
    if (key === "receita") updated.receita = Math.round(p.receita * factor);
    if (key === "despesa") updated.despesa = Math.round(p.despesa * factor);
    if (key === "lucro") updated.lucro = Math.round(p.lucro * factor);
    return updated;
  });
  if (key === "receita" || key === "despesa") {
    return next.map((p) => ({ ...p, lucro: p.receita - p.despesa }));
  }
  return next;
}
