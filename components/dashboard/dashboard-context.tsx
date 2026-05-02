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

type Ctx = {
  cards: IndicatorCard[];
  series: SeriesPoint[];
  attachments: Record<IndicatorKey, Attachment[]>;
  glowing: boolean;
  glowToken: number;
  triggerGlow: () => void;
  setCardValue: (key: IndicatorKey, value: number) => void;
  applyImported: (data: Partial<{
    cards: Partial<Record<IndicatorKey, number>>;
    series: SeriesPoint[];
  }>) => void;
  addAttachments: (key: IndicatorKey, files: File[]) => void;
  removeAttachment: (key: IndicatorKey, name: string) => void;
};

const DashboardContext = React.createContext<Ctx | null>(null);

const SEED_SERIES: SeriesPoint[] = [
  { month: "Jan", receita: 320000, despesa: 210000, lucro: 110000 },
  { month: "Fev", receita: 295000, despesa: 205000, lucro: 90000 },
  { month: "Mar", receita: 360000, despesa: 220000, lucro: 140000 },
  { month: "Abr", receita: 410000, despesa: 245000, lucro: 165000 },
  { month: "Mai", receita: 388000, despesa: 240000, lucro: 148000 },
  { month: "Jun", receita: 432000, despesa: 255000, lucro: 177000 },
  { month: "Jul", receita: 470000, despesa: 268000, lucro: 202000 },
  { month: "Ago", receita: 455000, despesa: 262000, lucro: 193000 },
];

const SEED_CARDS: IndicatorCard[] = [
  { key: "receita", label: "Receita acumulada", value: 3130000, format: "currency", hint: "Últimos 8 meses" },
  { key: "despesa", label: "Despesas operacionais", value: 1905000, format: "currency", hint: "Custos consolidados" },
  { key: "lucro", label: "Lucro líquido", value: 1225000, format: "currency", hint: "Margem em evolução" },
  { key: "ticket", label: "Ticket médio por evento", value: 78500, format: "currency", hint: "4 eventos anuais" },
];

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [cards, setCards] = React.useState<IndicatorCard[]>(SEED_CARDS);
  const [series, setSeries] = React.useState<SeriesPoint[]>(SEED_SERIES);
  const [attachments, setAttachments] = React.useState<Record<IndicatorKey, Attachment[]>>({
    receita: [],
    despesa: [],
    lucro: [],
    ticket: [],
  });
  const [glowing, setGlowing] = React.useState(false);
  const [glowToken, setGlowToken] = React.useState(0);
  const glowTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerGlow = React.useCallback(() => {
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
    setSeries((prev) => recalcSeries(prev, key, value));
  }, []);

  const applyImported = React.useCallback<Ctx["applyImported"]>((data) => {
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
        let next = prev;
        for (const k of Object.keys(data.cards!) as IndicatorKey[]) {
          const v = data.cards![k];
          if (typeof v === "number") next = recalcSeries(next, k, v);
        }
        return next;
      });
    }
    triggerGlow();
  }, [triggerGlow]);

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

// Reescala a série mantendo a forma original quando o usuário edita um card
function recalcSeries(series: SeriesPoint[], key: IndicatorKey, value: number): SeriesPoint[] {
  if (key === "ticket") return series;
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
  // Mantém coerência: lucro = receita - despesa quando receita ou despesa muda
  if (key === "receita" || key === "despesa") {
    return next.map((p) => ({ ...p, lucro: p.receita - p.despesa }));
  }
  return next;
}
