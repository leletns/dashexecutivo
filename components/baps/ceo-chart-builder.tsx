"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart2,
  Check,
  LayoutGrid,
  LineChart as LineIcon,
  PieChart as PieIcon,
  Plus,
  TrendingUp,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import type { BapsSnapshot } from "@/lib/baps/types";
import type { PortalFinanceiroSnapshot } from "@/lib/portal-financeiro/types";
import { DEPARTAMENTOS, EMPTY_SNAPSHOT } from "@/lib/portal-financeiro/types";
import { NpsComposedChart } from "./nps-composed-chart";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChartKey =
  | "nps"
  | "associados_historico"
  | "associados_mensal"
  | "departamentos"
  | "eventos";

interface ChartOption {
  key: ChartKey;
  title: string;
  description: string;
  icon: React.ElementType;
}

const CHART_OPTIONS: ChartOption[] = [
  {
    key: "nps",
    title: "Satisfação dos membros",
    description: "Comparação 2024 vs 2025 por grupo",
    icon: TrendingUp,
  },
  {
    key: "associados_historico",
    title: "Histórico de associados",
    description: "Total de associados ao final de agosto de cada ano",
    icon: LineIcon,
  },
  {
    key: "associados_mensal",
    title: "Acompanhamento 2026",
    description: "Renovações, novas adesões e saídas por mês",
    icon: BarChart2,
  },
  {
    key: "departamentos",
    title: "Custo por departamento",
    description: "Distribuição de custos entre as áreas",
    icon: PieIcon,
  },
  {
    key: "eventos",
    title: "Resultado por evento",
    description: "Bilheteria, patrocínio, despesas e resultado",
    icon: LayoutGrid,
  },
];

const PALETTE = [
  "#7C3AED", "#10B981", "#E5383B", "#F59E0B",
  "#3B82F6", "#EC4899", "#8B5CF6", "#06B6D4",
  "#84CC16", "#F97316", "#6366F1", "#14B8A6",
];

const MES_LABEL: Record<number, string> = {
  1: "Jan", 2: "Fev", 3: "Mar", 4: "Abr", 5: "Mai", 6: "Jun",
  7: "Jul", 8: "Ago", 9: "Set", 10: "Out", 11: "Nov", 12: "Dez",
};

const LS_KEY = "ceo-charts-v1";

// ─── Persistence ──────────────────────────────────────────────────────────────

function useStoredCharts() {
  const [charts, setCharts] = React.useState<ChartKey[]>(() => {
    if (typeof window === "undefined") return ["nps"];
    try {
      const stored = localStorage.getItem(LS_KEY);
      return stored ? (JSON.parse(stored) as ChartKey[]) : ["nps"];
    } catch {
      return ["nps"];
    }
  });

  const save = (next: ChartKey[]) => {
    setCharts(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  };

  const toggle = (key: ChartKey) =>
    save(charts.includes(key) ? charts.filter((k) => k !== key) : [...charts, key]);

  return { charts, toggle };
}

// ─── Portal data ──────────────────────────────────────────────────────────────

function usePortalData() {
  const [data, setData] = React.useState<PortalFinanceiroSnapshot>(EMPTY_SNAPSHOT);
  React.useEffect(() => {
    const mes = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    fetch(`/api/portal/financeiro?mes=${mes}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : EMPTY_SNAPSHOT))
      .then(setData)
      .catch(() => {});
  }, []);
  return data;
}

// ─── Individual charts ────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground text-center px-8">
      {message}
    </div>
  );
}

function ChartShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-6 rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm shadow-sm print:break-inside-avoid overflow-hidden">
      <header className="mb-4">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{subtitle}</p>
      </header>
      {children}
    </Card>
  );
}

function AssociadosHistoricoChart({ data }: { data: PortalFinanceiroSnapshot }) {
  const rows = data.associados_historico.map((h) => ({
    label: h.periodo_label,
    total: h.total_ativos,
  }));
  return (
    <ChartShell
      title="Histórico de associados"
      subtitle="Total de associados ativos ao final de agosto de cada ano (2022–2025)."
    >
      {rows.length === 0 ? (
        <EmptyState message="Preencha os dados históricos de associados na aba Financeiro — Associados." />
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/45" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
              <Tooltip formatter={(v: number) => [v.toLocaleString("pt-BR"), "Associados"]} />
              <Line
                type="monotone"
                dataKey="total"
                name="Associados"
                stroke="#7C3AED"
                strokeWidth={2.5}
                dot={{ fill: "#7C3AED", r: 5, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#7C3AED" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartShell>
  );
}

function AssociadosMensalChart({ data }: { data: PortalFinanceiroSnapshot }) {
  const rows = data.associados_mensal.map((m) => ({
    mes: MES_LABEL[m.mes] ?? `M${m.mes}`,
    renovadas: m.renovacoes_realizadas,
    previstas: m.previsao_renovacoes,
    novas: m.novas_adesoes,
    saidas: m.saidas,
  }));
  const hasData = rows.some((r) => r.renovadas > 0 || r.novas > 0 || r.previstas > 0);
  return (
    <ChartShell
      title="Acompanhamento de associados — 2026"
      subtitle="Renovações realizadas e previstas, novas adesões e saídas por mês."
    >
      {!hasData ? (
        <EmptyState message="Preencha o acompanhamento mensal 2026 na aba Financeiro — Associados." />
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/45" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="previstas" name="Prev. renovação" fill="#A5B4FC" radius={[4, 4, 0, 0]} barSize={14} />
              <Bar dataKey="renovadas" name="Renovações" fill="#7C3AED" radius={[4, 4, 0, 0]} barSize={14} />
              <Bar dataKey="novas" name="Novas adesões" fill="#10B981" radius={[4, 4, 0, 0]} barSize={14} />
              <Bar dataKey="saidas" name="Saídas" fill="#E5383B" radius={[4, 4, 0, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartShell>
  );
}

function DepartamentosChart({ data }: { data: PortalFinanceiroSnapshot }) {
  const rows = DEPARTAMENTOS.map((d) => ({
    name: d,
    value: data.custos_departamento.find((c) => c.departamento === d)?.valor_mensal ?? 0,
  }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <ChartShell
      title="Custo por departamento"
      subtitle="Distribuição do custo mensal entre as áreas da organização."
    >
      {rows.length === 0 ? (
        <EmptyState message="Preencha os custos por departamento na aba Financeiro — Departamentos." />
      ) : (
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: 70, left: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border/45" />
              <XAxis
                type="number"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={120}
              />
              <Tooltip formatter={(v: number) => [formatCurrencyBRL(v), "Custo mensal"]} />
              <Bar dataKey="value" name="Custo" radius={[0, 4, 4, 0]}>
                {rows.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartShell>
  );
}

function EventosChart({ data }: { data: PortalFinanceiroSnapshot }) {
  const rows = data.eventos_resultado.map((ev) => ({
    evento: ev.nome_evento,
    bilheteria: ev.receita_bilheteria,
    patrocinio: ev.receita_patrocinio,
    despesas: ev.despesas_total,
    resultado:
      ev.receita_bilheteria + ev.receita_patrocinio + ev.receita_outros - ev.despesas_total,
  }));

  return (
    <ChartShell
      title="Resultado por evento"
      subtitle="Bilheteria, patrocínio, despesas e resultado por evento do mês."
    >
      {rows.length === 0 ? (
        <EmptyState message="Preencha os resultados de eventos na aba Financeiro — Eventos." />
      ) : (
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/45" />
              <XAxis dataKey="evento" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={56}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip formatter={(v: number) => [formatCurrencyBRL(v)]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="bilheteria" name="Bilheteria" fill="#7C3AED" radius={[4, 4, 0, 0]} barSize={18} />
              <Bar dataKey="patrocinio" name="Patrocínio" fill="#10B981" radius={[4, 4, 0, 0]} barSize={18} />
              <Bar dataKey="despesas" name="Despesas" fill="#E5383B" radius={[4, 4, 0, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartShell>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CeoChartBuilder({ data }: { data: BapsSnapshot }) {
  const { charts, toggle } = useStoredCharts();
  const portalData = usePortalData();
  const [showPicker, setShowPicker] = React.useState(false);
  const pickerRef = React.useRef<HTMLDivElement>(null);

  // Close picker on outside click
  React.useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  const renderChart = (key: ChartKey) => {
    switch (key) {
      case "nps":
        return <NpsComposedChart data={data} />;
      case "associados_historico":
        return <AssociadosHistoricoChart data={portalData} />;
      case "associados_mensal":
        return <AssociadosMensalChart data={portalData} />;
      case "departamentos":
        return <DepartamentosChart data={portalData} />;
      case "eventos":
        return <EventosChart data={portalData} />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Rendered charts */}
      <AnimatePresence initial={false}>
        {charts.map((key) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(4px)" }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative group/chart"
          >
            {renderChart(key)}
            <button
              onClick={() => toggle(key)}
              className={cn(
                "absolute top-4 right-4 p-1.5 rounded-lg transition-all duration-150",
                "opacity-0 group-hover/chart:opacity-100",
                "bg-foreground/5 hover:bg-red-500/10",
                "text-muted-foreground hover:text-red-500",
              )}
              aria-label="Remover gráfico"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Add chart button + picker */}
      <div className="relative" ref={pickerRef}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPicker((p) => !p)}
          className="gap-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar gráfico
        </Button>

        <AnimatePresence>
          {showPicker && (
            <motion.div
              initial={{ opacity: 0, y: -6, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="absolute left-0 top-10 z-30 w-80 rounded-2xl border border-border/60 bg-popover/95 backdrop-blur-md shadow-xl p-2"
            >
              <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Selecione os gráficos
              </p>

              {CHART_OPTIONS.map((opt) => {
                const active = charts.includes(opt.key);
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.key}
                    onClick={() => toggle(opt.key)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-100",
                      active
                        ? "bg-violet-500/10 text-violet-700 dark:text-violet-300"
                        : "text-foreground hover:bg-foreground/[0.04]",
                    )}
                  >
                    <div
                      className={cn(
                        "h-7 w-7 rounded-lg grid place-items-center flex-shrink-0",
                        active ? "bg-violet-500/15" : "bg-muted/50",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-none">{opt.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                        {opt.description}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "h-4 w-4 flex-shrink-0 rounded border transition-colors duration-100",
                        active
                          ? "bg-violet-500 border-violet-500"
                          : "border-border/60",
                      )}
                    >
                      {active && <Check className="h-4 w-4 text-white p-0.5" />}
                    </div>
                  </button>
                );
              })}

              <div className="mt-1 pt-1.5 border-t border-border/40 px-2 pb-1">
                <p className="text-[10px] text-muted-foreground/60">
                  Os gráficos selecionados são salvos automaticamente.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
