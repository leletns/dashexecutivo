"use client";

import * as React from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, animate } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  Search,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Activity,
  Wifi,
  WifiOff,
  Plus,
  PencilLine,
  CircleDot,
  X,
  RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, type SelectOption } from "@/components/ui/select";
import { PortalFinanceiroTabs } from "@/components/financeiro/portal-financeiro-tabs";
import { useAppState, metricasEdicao, type FinanceLancamento } from "@/lib/app-state";
import { useRegisterPageState } from "@/lib/page-state";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import { todayBrasilia } from "@/lib/timezone";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const ANOS = ["2022", "2023", "2024", "2025", "2026"];

// ---------------------------------------------------------------------------
// Compact BRL
// ---------------------------------------------------------------------------

function fmtCompact(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const s = (abs / 1_000_000).toFixed(1).replace(".", ",");
    return `${sign}R$ ${s}M`;
  }
  if (abs >= 1_000) {
    const s = (abs / 1_000).toFixed(0);
    return `${sign}R$ ${s}k`;
  }
  return formatCurrencyBRL(value);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LancStatusFilter = "todos" | "pago" | "aberto";

interface FluxoTotais {
  total_receitas_pagas: number;
  total_despesas_pagas: number;
  total_a_receber: number;
  total_a_pagar: number;
  saldo_realizado: number;
  resultado_projetado: number;
}

interface FluxoRow {
  mes: string;
  chave?: string;
  entradas: number;
  saidas: number;
  saldo: number;
  acumulado: number;
}

interface EventoRow {
  nome: string;
  Receita: number;
  Despesa: number;
  resultado: number;
}

interface LancSupabase {
  id: string;
  nome_razao_social?: string;
  descricao?: string;
  evento?: string;
  classificacao?: string;
  situacao?: string;
  valor: number;
  data_vencimento?: string;
  data_pagamento?: string;
  rec_desp?: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useLancamentosFluxo(ano: string) {
  const [fluxoSupabase, setFluxoSupabase] = React.useState<FluxoRow[]>([]);
  const [porEvento, setPorEvento] = React.useState<EventoRow[]>([]);
  const [totaisSupabase, setTotaisSupabase] = React.useState<FluxoTotais | null>(null);
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = React.useState(false);

  // Fast path: RPC direto ao Supabase (sem roundtrip por API Route)
  // Atualiza KPIs em ~50ms quando Realtime dispara
  const fetchTotais = React.useCallback(async () => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    const params = ano ? { p_ano: ano } : {};
    const { data, error } = await sb.rpc("lancamentos_totais", params);
    if (!error && data?.[0]) {
      setTotaisSupabase(data[0] as FluxoTotais);
      setUpdatedAt(new Date().toISOString());
    }
  }, [ano]);

  // Full fetch: fluxo mensal + por evento + totais (via API Route autenticada)
  const fetchData = React.useCallback(() => {
    const url = `/api/lancamentos/fluxo${ano ? `?ano=${encodeURIComponent(ano)}` : ""}`;
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: any) => {
        if (!d) return;
        setFluxoSupabase((d.fluxo_mensal ?? []) as FluxoRow[]);
        setPorEvento((d.por_evento ?? []) as EventoRow[]);
        if (d.totais) setTotaisSupabase(d.totais as FluxoTotais);
        setUpdatedAt(new Date().toISOString());
      })
      .catch(() => {});
  }, [ano]);

  React.useEffect(() => {
    fetchData();

    const sb = getSupabaseBrowser();
    const channel = sb
      ?.channel("lancamentos-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "portal_lancamentos" },
        () => {
          fetchTotais(); // KPIs atualizam imediatamente
          fetchData();   // gráficos atualizam logo após
        },
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    window.addEventListener("portal:data-updated", fetchData);
    return () => {
      channel?.unsubscribe();
      setRealtimeConnected(false);
      window.removeEventListener("portal:data-updated", fetchData);
    };
  }, [fetchData, fetchTotais]);

  return { fluxoSupabase, porEvento, totaisSupabase, updatedAt, realtimeConnected };
}

function useTotalCount(ano: string) {
  const [count, setCount] = React.useState<number | null>(null);
  React.useEffect(() => {
    const qs = ano ? `?ano=${encodeURIComponent(ano)}&limit=1` : "?limit=1";
    fetch(`/api/lancamentos${qs}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: any) => { if (d?.total != null) setCount(Number(d.total)); })
      .catch(() => {});
  }, [ano]);
  return count;
}


// ---------------------------------------------------------------------------
// Hook: baps_dashboard_dados (Data Lake)
// ---------------------------------------------------------------------------

interface BapsDadosTotais {
  receitas: number;
  despesas: number;
  saldo: number;
  resultado_projetado: number;
  a_receber: number;
  a_pagar: number;
}

interface BapsDadosPorAba {
  aba_origem: string;
  receitas: number;
  despesas: number;
  saldo: number;
  campos: string[];
  sample: Record<string, any>;
}

interface BapsDadosRegistro {
  id: number;
  aba_origem: string;
  dados: Record<string, any>;
  criado_em: string;
}

interface BapsDadosState {
  totais: BapsDadosTotais | null;
  porAba: BapsDadosPorAba[];
  registros: BapsDadosRegistro[];
  total: number;
  page: number;
  pages: number;
  loading: boolean;
  error: string | null;
}

function useBapsDados(abaFiltro: string, page = 1) {
  const [state, setState] = React.useState<BapsDadosState>({
    totais: null, porAba: [], registros: [], total: 0, page: 1, pages: 1, loading: false, error: null,
  });

  React.useEffect(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const qs = new URLSearchParams({ page: String(page), limit: "100" });
    if (abaFiltro) qs.set("aba", abaFiltro);
    fetch(`/api/baps-dados?${qs}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((d: any) => setState({
        totais:    d.totais ?? null,
        porAba:    d.por_aba ?? [],
        registros: d.registros ?? [],
        total:     d.total ?? 0,
        page:      d.page ?? 1,
        pages:     d.pages ?? 1,
        loading:   false,
        error:     null,
      }))
      .catch((e: any) => setState((s) => ({ ...s, loading: false, error: String(e) })));
  }, [abaFiltro, page]);

  return state;
}

// ---------------------------------------------------------------------------
// Animated counter
// ---------------------------------------------------------------------------

function AnimatedNumber({ value, format = "currency" }: { value: number; format?: "currency" | "compact" }) {
  const motionVal = useMotionValue(value);
  const [display, setDisplay] = React.useState(value);

  React.useEffect(() => {
    const controls = animate(motionVal, value, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    });
    const unsub = motionVal.on("change", (v) => setDisplay(v));
    return () => { controls.stop(); unsub(); };
  }, [value, motionVal]);

  return <>{format === "compact" ? fmtCompact(display) : formatCurrencyBRL(display)}</>;
}

// ---------------------------------------------------------------------------
// Status pill — Monday-style
// ---------------------------------------------------------------------------

type StatusKind = "received" | "pending-in" | "pending-out" | "overdue" | "paid";

function getStatusKind(situacao: string | undefined, recDesp: "Receitas" | "Despesas", dataVencimento?: string): StatusKind {
  const hoje = todayBrasilia();
  if (!situacao) return recDesp === "Receitas" ? "pending-in" : "pending-out";
  if (situacao === "Recebido") return "received";
  if (situacao === "Pago") return "paid";
  if ((situacao === "A receber" || situacao === "A pagar") && dataVencimento && dataVencimento < hoje) return "overdue";
  if (situacao === "A receber") return "pending-in";
  return "pending-out";
}

const STATUS_CONFIG: Record<StatusKind, { label: string; bg: string; text: string; dot: string; pulse?: boolean }> = {
  received: {
    label: "Recebido",
    bg: "bg-emerald-500/10 dark:bg-emerald-400/10",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  paid: {
    label: "Pago",
    bg: "bg-emerald-500/10 dark:bg-emerald-400/10",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  "pending-in": {
    label: "A receber",
    bg: "bg-amber-500/10 dark:bg-amber-400/10",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  "pending-out": {
    label: "A pagar",
    bg: "bg-blue-500/10 dark:bg-blue-400/10",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  overdue: {
    label: "Vencido",
    bg: "bg-rose-500/10 dark:bg-rose-400/10",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
    pulse: true,
  },
};

const ROW_BORDER: Record<StatusKind, string> = {
  received: "border-l-2 border-l-emerald-500",
  paid: "border-l-2 border-l-emerald-500",
  "pending-in": "border-l-2 border-l-amber-500",
  "pending-out": "border-l-2 border-l-blue-400",
  overdue: "border-l-2 border-l-rose-500",
};

function StatusPill({ situacao, recDesp, dataVencimento }: { situacao?: string; recDesp: "Receitas" | "Despesas"; dataVencimento?: string }) {
  const kind = getStatusKind(situacao, recDesp, dataVencimento);
  const cfg = STATUS_CONFIG[kind];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium", cfg.bg, cfg.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot, cfg.pulse && "animate-pulse")} />
      {situacao ?? cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-t border-border/30 animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className={cn("h-3 rounded bg-foreground/[0.06]", i === 0 ? "w-16" : i === 1 ? "w-32" : "w-20")} />
        </td>
      ))}
    </tr>
  );
}

function SkeletonKpi() {
  return (
    <Card className="p-4 animate-pulse">
      <div className="h-3 w-24 bg-foreground/[0.06] rounded mb-3" />
      <div className="h-7 w-28 bg-foreground/[0.06] rounded mb-2" />
      <div className="h-2 w-16 bg-foreground/[0.04] rounded" />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Live indicator
// ---------------------------------------------------------------------------

function LiveDot({ connected }: { connected: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors",
      connected
        ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
        : "text-muted-foreground bg-foreground/[0.04]"
    )}>
      {connected ? (
        <>
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Ao vivo
        </>
      ) : (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
          Offline
        </>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Year selector
// ---------------------------------------------------------------------------

function AnoSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {(["", ...ANOS] as string[]).map((a) => (
        <button
          key={a || "todos"}
          onClick={() => onChange(a)}
          className={cn(
            "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all whitespace-nowrap",
            value === a
              ? "bg-foreground text-background shadow-sm"
              : "bg-foreground/[0.06] hover:bg-foreground/[0.11] text-muted-foreground",
          )}
        >
          {a || "Todos"}
        </button>
      ))}
    </div>
  );
}


// -----------
// Page
// ---------------------------------------------------------------------------

export default function FinanceiroPage() {
  const { state } = useAppState();
  const [anoFiltro, setAnoFiltro] = React.useState<string>("");
  const [activeTab, setActiveTab] = React.useState("overview");

  const { fluxoSupabase, porEvento, totaisSupabase, updatedAt, realtimeConnected } = useLancamentosFluxo(anoFiltro);
  const totalCount = useTotalCount(anoFiltro);

  const margens = React.useMemo(
    () => computeMargensPorEdicao(state.edicoes, state.financeiro),
    [state.edicoes, state.financeiro],
  );

  const fluxoMensal: FluxoMensal[] = React.useMemo(() => {
    let acumulado = 0;
    return [...fluxoSupabase]
      .sort((a, b) => (a.chave ?? a.mes).localeCompare(b.chave ?? b.mes))
      .map((r) => {
        const saldo = r.entradas - r.saidas;
        acumulado += saldo;
        return { ...r, saldo, acumulado };
      });
  }, [fluxoSupabase]);

  const autoTotais = React.useMemo(() => ({
    entradasPeriodo: fluxoMensal.reduce((s, r) => s + r.entradas, 0),
    saidasPeriodo: fluxoMensal.reduce((s, r) => s + r.saidas, 0),
  }), [fluxoMensal]);

  // Fonte única de verdade: Supabase (portal_lancamentos)
  const displayTotals: Totals = {
    saldoConferido:     totaisSupabase?.saldo_realizado    ?? autoTotais.entradasPeriodo - autoTotais.saidasPeriodo,
    aReceber:           totaisSupabase?.total_a_receber    ?? 0,
    aReceberCount:      0,
    aPagar:             totaisSupabase?.total_a_pagar      ?? 0,
    aPagarCount:        0,
    resultadoProjetado: totaisSupabase?.resultado_projetado ?? 0,
    entradasPeriodo:    autoTotais.entradasPeriodo,
    saidasPeriodo:      autoTotais.saidasPeriodo,
  };

  useRegisterPageState({
    module: "Financeiro",
    summary: [
      { label: "A receber", value: formatCurrencyBRL(displayTotals.aReceber) },
      { label: "A pagar", value: formatCurrencyBRL(displayTotals.aPagar) },
      { label: "Saldo em caixa", value: formatCurrencyBRL(displayTotals.saldoConferido) },
      { label: "Resultado projetado", value: formatCurrencyBRL(displayTotals.resultadoProjetado) },
    ],
  });

  const relTime = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "agora";
    if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h atrás`;
    return `${Math.floor(diff / 86400)} dias atrás`;
  };

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Financeiro</h1>
          <p className="text-xs text-muted-foreground">
            {totalCount != null
              ? `${totalCount.toLocaleString("pt-BR")} movimentações${anoFiltro ? ` em ${anoFiltro}` : ""}${updatedAt ? ` · atualizado ${relTime(updatedAt)}` : ""}`
              : "Entradas, saídas e saldo · dados em tempo real"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <LiveDot connected={realtimeConnected} />
          <AnoSelector value={anoFiltro} onChange={setAnoFiltro} />
        </div>
      </motion.div>

      <KpiGrid
        totals={displayTotals}
        onVerDetalhes={setActiveTab}
        loading={totaisSupabase === null && updatedAt === null}
      />

      <PortalFinanceiroTabs />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Resumo</TabsTrigger>
          <TabsTrigger value="fluxo">Mês a mês</TabsTrigger>
          <TabsTrigger value="receber">A receber</TabsTrigger>
          <TabsTrigger value="pagar">A pagar</TabsTrigger>
          <TabsTrigger value="margem">Resultado por evento</TabsTrigger>
          <TabsTrigger value="datalake">Data Lake</TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <TabsContent value="overview" className="mt-2">
              <OverviewTab
                totals={displayTotals}
                fluxoMensal={fluxoMensal}
                margens={margens}
                porEvento={porEvento}
                ano={anoFiltro}
              />
            </TabsContent>

            <TabsContent value="fluxo" className="mt-2">
              <FluxoTab
                fluxoMensal={fluxoMensal}
                totals={displayTotals}
              />
            </TabsContent>

            <TabsContent value="receber" className="mt-2">
              <LancamentosSupabaseTab recDesp="Receitas" ano={anoFiltro} />
            </TabsContent>

            <TabsContent value="pagar" className="mt-2">
              <LancamentosSupabaseTab recDesp="Despesas" ano={anoFiltro} />
            </TabsContent>

            <TabsContent value="margem" className="mt-2">
              <MargemTab margens={margens} porEvento={porEvento} />
            </TabsContent>

            <TabsContent value="datalake" className="mt-2">
              <DataLakeTab />
            </TabsContent>
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </div>
  );
}


// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

function KpiGrid({
  totals,
  onVerDetalhes,
  loading,
}: {
  totals: Totals;
  onVerDetalhes: (tab: string) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <SkeletonKpi key={i} />)}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        label="Saldo em caixa"
        value={totals.saldoConferido}
        hint="Recebimentos − pagamentos realizados"
        icon={<Wallet className="h-3.5 w-3.5" />}
        accentColor="border-t-violet-500"
        onDetalhes={() => onVerDetalhes("fluxo")}
      />
      <KpiCard
        label="A receber"
        value={totals.aReceber}
        hint="Pendente de recebimento"
        count={totals.aReceberCount > 0 ? totals.aReceberCount : undefined}
        icon={<ArrowDownRight className="h-3.5 w-3.5" />}
        accent="emerald"
        accentColor="border-t-emerald-500"
        onDetalhes={() => onVerDetalhes("receber")}
      />
      <KpiCard
        label="A pagar"
        value={totals.aPagar}
        hint="Pendente de pagamento"
        count={totals.aPagarCount > 0 ? totals.aPagarCount : undefined}
        icon={<ArrowUpRight className="h-3.5 w-3.5" />}
        accent="rose"
        accentColor="border-t-rose-500"
        onDetalhes={() => onVerDetalhes("pagar")}
      />
      <KpiCard
        label="Resultado projetado"
        value={totals.resultadoProjetado}
        hint="Saldo + a receber − a pagar"
        icon={<Receipt className="h-3.5 w-3.5" />}
        accent={totals.resultadoProjetado >= 0 ? "emerald" : "rose"}
        accentColor={totals.resultadoProjetado >= 0 ? "border-t-emerald-500" : "border-t-rose-500"}
        trend={totals.resultadoProjetado >= 0 ? "up" : "down"}
        onDetalhes={() => onVerDetalhes("overview")}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  accent,
  accentColor,
  count,
  trend,
  onDetalhes,
}: {
  label: string;
  value: number;
  hint?: string;
  icon?: React.ReactNode;
  accent?: "emerald" | "rose";
  accentColor?: string;
  count?: number;
  trend?: "up" | "down";
  onDetalhes?: () => void;
}) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}>
      <Card
        className={cn(
          "p-4 overflow-hidden flex flex-col gap-2 border-t-2 cursor-default transition-shadow hover:shadow-md",
          accentColor ?? "border-t-border",
        )}
      >
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium text-muted-foreground tracking-tight leading-tight truncate">
              {label}
            </div>
            {hint && (
              <div className="text-[10px] text-muted-foreground/55 mt-0.5 truncate">{hint}</div>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {count != null && (
              <span className="text-[10px] font-semibold bg-foreground/[0.07] text-muted-foreground px-1.5 py-0.5 rounded-full">
                {count}
              </span>
            )}
            {icon && (
              <div className={cn(
                "h-7 w-7 rounded-lg grid place-items-center shrink-0",
                accent === "emerald" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                accent === "rose" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" :
                "bg-foreground/[0.05] text-muted-foreground"
              )}>
                {icon}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-end justify-between gap-1">
          <div
            className={cn(
              "text-[22px] font-semibold tracking-tight tabular-nums leading-none truncate",
              accent === "emerald" && "text-emerald-600 dark:text-emerald-400",
              accent === "rose" && "text-rose-600 dark:text-rose-400",
            )}
            title={formatCurrencyBRL(value)}
          >
            <AnimatedNumber value={value} format="compact" />
          </div>
          {trend && (
            <span className={cn("shrink-0 mb-0.5",
              trend === "up" ? "text-emerald-500" : "text-rose-500"
            )}>
              {trend === "up"
                ? <TrendingUp className="h-3.5 w-3.5" />
                : <TrendingDown className="h-3.5 w-3.5" />
              }
            </span>
          )}
        </div>

        {onDetalhes && (
          <button
            onClick={onDetalhes}
            className="text-[10px] text-muted-foreground/55 hover:text-foreground transition-colors leading-none text-left mt-0.5"
          >
            Ver detalhes →
          </button>
        )}
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------------

function OverviewTab({
  totals,
  fluxoMensal,
  margens,
  porEvento,
  ano,
}: {
  totals: Totals;
  fluxoMensal: FluxoMensal[];
  margens: MargemEdicao[];
  porEvento: EventoRow[];
  ano: string;
}) {
  const barData =
    porEvento.length > 0
      ? porEvento
      : margens.map((m) => ({
          nome: m.edicao.nome,
          Receita: m.receitaTotal,
          Despesa: m.despesaTotal,
          resultado: m.receitaTotal - m.despesaTotal,
        }));

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div>
            <div className="text-sm font-semibold tracking-tight">
              Fluxo de caixa{ano ? ` — ${ano}` : ""}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Movimentações realizadas · dados do sistema financeiro
            </div>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <Legend dot="bg-emerald-500" label="Entradas" />
            <Legend dot="bg-rose-500" label="Saídas" />
            <Legend dot="bg-violet-500" label="Saldo acum." />
          </div>
        </div>
        {fluxoMensal.length === 0 ? (
          <EmptyChart message="Sem movimentações liquidadas no período selecionado." />
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fluxoMensal} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-entradas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(16,185,129)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="rgb(16,185,129)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="grad-saidas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(244,63,94)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="rgb(244,63,94)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="grad-acumulado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(139,92,246)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="rgb(139,92,246)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                <XAxis
                  dataKey="mes"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`}
                  width={48}
                />
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                <Tooltip content={<MoneyTip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1.5 }} />
                <Area type="monotone" dataKey="entradas" name="Entradas" stroke="rgb(16,185,129)" strokeWidth={2} fill="url(#grad-entradas)" dot={false} />
                <Area type="monotone" dataKey="saidas" name="Saídas" stroke="rgb(244,63,94)" strokeWidth={2} fill="url(#grad-saidas)" dot={false} />
                <Area type="monotone" dataKey="acumulado" name="Saldo acum." stroke="rgb(139,92,246)" strokeWidth={2} fill="url(#grad-acumulado)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-3">
        <Card className="p-5">
          <div className="text-sm font-semibold tracking-tight mb-1">Resultado por evento</div>
          <div className="text-[11px] text-muted-foreground mb-4">
            Receitas × despesas · top {barData.length} eventos
          </div>
          {barData.length === 0 ? (
            <EmptyChart message="Sem eventos nas movimentações do período." height="h-[200px]" />
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }} barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                  <XAxis
                    dataKey="nome"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => (String(v).length > 18 ? `${String(v).slice(0, 16)}…` : String(v))}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<MoneyTip />} cursor={{ fill: "hsl(var(--muted) / 0.2)" }} />
                  <Bar dataKey="Receita" fill="rgb(16,185,129)" radius={[6, 6, 0, 0]} fillOpacity={0.9} />
                  <Bar dataKey="Despesa" fill="rgb(244,63,94)" radius={[6, 6, 0, 0]} fillOpacity={0.75} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold tracking-tight mb-2">Próximos vencimentos</div>
          <ProximosVencimentos />
        </Card>
      </div>
    </div>
  );
}

function EmptyChart({ message, height = "h-[280px]" }: { message: string; height?: string }) {
  return (
    <div className={cn(height, "grid place-items-center text-center")}>
      <div className="space-y-2">
        <div className="text-3xl opacity-20">📊</div>
        <div className="text-xs text-muted-foreground max-w-[200px]">{message}</div>
      </div>
    </div>
  );
}

function ProximosVencimentos() {
  const { state, togglePago } = useAppState();
  const hoje = todayBrasilia();
  const proximos = state.financeiro
    .filter((f) => !f.pagamento)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    .slice(0, 6);

  if (proximos.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <CheckCircle2 className="h-7 w-7 text-emerald-500 mx-auto opacity-60" />
        <div className="text-xs text-muted-foreground">Sem lançamentos em aberto. Tudo conciliado.</div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {proximos.map((l) => {
        const atrasado = l.vencimento < hoje;
        return (
          <motion.div
            key={l.id}
            layout
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors",
              atrasado
                ? "border-rose-200 dark:border-rose-900/50 bg-rose-500/[0.04]"
                : "border-border/50 bg-foreground/[0.02] dark:bg-white/[0.03]",
            )}
          >
            <span className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              atrasado ? "bg-rose-500 animate-pulse" :
              l.tipo === "receita" ? "bg-amber-500" : "bg-blue-400",
            )} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate">{l.descricao}</div>
              <div className="text-[10px] text-muted-foreground">
                Vence em {formatDateBR(l.vencimento)}
                {atrasado && <span className="ml-1.5 text-rose-500 font-medium">· vencido</span>}
              </div>
            </div>
            <div className={cn(
              "text-sm font-semibold tabular-nums shrink-0",
              l.tipo === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/80",
            )}>
              {l.tipo === "receita" ? "+" : "−"}{formatCurrencyBRL(l.valor).replace("R$", "R$ ")}
            </div>
            <button
              onClick={() => togglePago(l.id, true)}
              className="h-7 w-7 grid place-items-center rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors"
              aria-label="Marcar como liquidado"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fluxo de caixa
// ---------------------------------------------------------------------------

function FluxoTab({
  fluxoMensal,
  totals,
}: {
  fluxoMensal: FluxoMensal[];
  totals: Totals;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label="Total de entradas"
          value={totals.entradasPeriodo}
          hint="Recebimentos liquidados no período"
          icon={<ArrowDownRight className="h-3.5 w-3.5" />}
          accent="emerald"
          accentColor="border-t-emerald-500"
        />
        <KpiCard
          label="Total de saídas"
          value={totals.saidasPeriodo}
          hint="Pagamentos efetuados no período"
          icon={<ArrowUpRight className="h-3.5 w-3.5" />}
          accent="rose"
          accentColor="border-t-rose-500"
        />
        <KpiCard
          label="Saldo do período"
          value={totals.entradasPeriodo - totals.saidasPeriodo}
          hint="Resultado realizado"
          icon={<Wallet className="h-3.5 w-3.5" />}
          accent={totals.entradasPeriodo - totals.saidasPeriodo >= 0 ? "emerald" : "rose"}
          accentColor={totals.entradasPeriodo - totals.saidasPeriodo >= 0 ? "border-t-emerald-500" : "border-t-rose-500"}
          trend={totals.entradasPeriodo - totals.saidasPeriodo >= 0 ? "up" : "down"}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50">
          <div className="text-sm font-semibold tracking-tight">Mês a mês</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {fluxoMensal.length} meses com movimentações realizadas
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-foreground/[0.02] dark:bg-white/[0.02] border-b border-border/50">
                {["Mês", "Entradas", "Saídas", "Saldo do mês", "Saldo acumulado"].map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium",
                      i === 0 ? "text-left" : "text-right",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fluxoMensal.map((row, idx) => {
                const key = (row as any).chave ?? row.mes;
                const saldoPos = row.saldo >= 0;
                return (
                  <motion.tr
                    key={key}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    className="border-t border-border/40 hover:bg-foreground/[0.015] dark:hover:bg-white/[0.015] transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium text-sm">{row.mes || key}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                      {formatCurrencyBRL(row.entradas)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-rose-600 dark:text-rose-400">
                      {formatCurrencyBRL(row.saidas)}
                    </td>
                    <td className={cn(
                      "px-4 py-2.5 text-right tabular-nums font-semibold",
                      saldoPos ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    )}>
                      <span className="inline-flex items-center gap-1">
                        {saldoPos
                          ? <TrendingUp className="h-3 w-3 opacity-60" />
                          : <TrendingDown className="h-3 w-3 opacity-60" />
                        }
                        {formatCurrencyBRL(row.saldo)}
                      </span>
                    </td>
                    <td className={cn(
                      "px-4 py-2.5 text-right tabular-nums font-semibold",
                      row.acumulado >= 0 ? "text-foreground" : "text-rose-600 dark:text-rose-400"
                    )}>
                      {formatCurrencyBRL(row.acumulado)}
                    </td>
                  </motion.tr>
                );
              })}

              {fluxoMensal.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-xs text-muted-foreground py-12">
                    <div className="space-y-2">
                      <div className="text-2xl opacity-20">📋</div>
                      <div>Sem movimentações no período selecionado.</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lançamentos do Supabase (paginado)
// ---------------------------------------------------------------------------

function LancamentosSupabaseTab({
  recDesp,
  ano,
}: {
  recDesp: "Receitas" | "Despesas";
  ano: string;
}) {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [situacao, setSituacao] = React.useState("");
  const [lancamentos, setLancamentos] = React.useState<LancSupabase[]>([]);
  const [total, setTotal] = React.useState(0);
  const [pages, setPages] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const limit = 50;

  const titulo = recDesp === "Receitas" ? "Contas a receber" : "Contas a pagar";

  const fetchData = React.useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      rec_desp: recDesp,
      page: String(page),
      limit: String(limit),
    });
    if (ano) params.set("ano", ano);
    if (search.trim()) params.set("search", search.trim());
    if (situacao) params.set("situacao", situacao);

    fetch(`/api/lancamentos?${params.toString()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: any) => {
        if (!d) return;
        setLancamentos((d.data ?? []) as LancSupabase[]);
        setTotal(d.total ?? 0);
        setPages(d.pages ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [recDesp, page, ano, search, situacao]);

  React.useEffect(() => {
    setPage(1);
  }, [ano, search, situacao, recDesp]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statusOptions: SelectOption[] =
    recDesp === "Receitas"
      ? [
          { value: "", label: "Todos" },
          { value: "A receber", label: "A receber" },
          { value: "Recebido", label: "Recebido" },
        ]
      : [
          { value: "", label: "Todos" },
          { value: "A pagar", label: "A pagar" },
          { value: "Pago", label: "Pago" },
        ];

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, evento ou classificação…"
            className="pl-8"
          />
        </div>
        <Select
          value={situacao}
          onValueChange={setSituacao}
          options={statusOptions}
          triggerClassName="min-w-[160px]"
        />
        <span className="text-[11px] text-muted-foreground ml-auto hidden sm:block">
          {total.toLocaleString("pt-BR")} registros{ano ? ` · ${ano}` : ""}
        </span>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold">{titulo}</span>
          </div>
          <span className="text-[11px] text-muted-foreground sm:hidden">
            {total.toLocaleString("pt-BR")} registros
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-foreground/[0.02] dark:bg-white/[0.02] border-b border-border/50">
                {[
                  ["left", "Status"],
                  ["left", "Nome / Descrição"],
                  ["left", "Evento"],
                  ["left", "Vencimento"],
                  ["left", "Liquidação"],
                  ["right", "Valor"],
                ].map(([align, label]) => (
                  <th
                    key={label}
                    className={cn(
                      "px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium",
                      `text-${align}`,
                    )}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 8 }).map((_, i) => (
                <SkeletonRow key={i} cols={6} />
              ))}
              {!loading && lancamentos.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-xs text-muted-foreground py-12">
                    <div className="space-y-2">
                      <div className="text-2xl opacity-20">🔍</div>
                      <div>Nenhum lançamento encontrado{search ? ` para "${search}"` : ""}.</div>
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                lancamentos.map((l, idx) => {
                  const kind = getStatusKind(l.situacao, recDesp, l.data_vencimento);
                  return (
                    <motion.tr
                      key={l.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.015 }}
                      className={cn(
                        "border-t border-border/40 hover:bg-foreground/[0.02] dark:hover:bg-white/[0.015] transition-colors",
                        ROW_BORDER[kind],
                      )}
                    >
                      <td className="px-4 py-3">
                        <StatusPill situacao={l.situacao} recDesp={recDesp} dataVencimento={l.data_vencimento} />
                      </td>
                      <td className="px-4 py-3 max-w-[240px]">
                        <div className="text-sm font-medium truncate">
                          {l.nome_razao_social || l.descricao || "—"}
                        </div>
                        {l.classificacao && (
                          <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {l.classificacao}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px]">
                        <div className="truncate">{l.evento || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums">
                        {l.data_vencimento ? (
                          <span className={cn(kind === "overdue" && "text-rose-600 dark:text-rose-400 font-medium")}>
                            {formatDateBR(l.data_vencimento)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums">
                        {l.data_pagamento ? (
                          <span className="text-emerald-600 dark:text-emerald-400">{formatDateBR(l.data_pagamento)}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className={cn(
                        "px-4 py-3 text-right font-semibold tabular-nums text-sm",
                        recDesp === "Receitas"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-foreground/85",
                      )}>
                        {recDesp === "Receitas" ? "+" : "−"}
                        {formatCurrencyBRL(Number(l.valor) || 0).replace("R$", "R$ ")}
                      </td>
                    </motion.tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Página {page} de {pages} · {total.toLocaleString("pt-BR")} registros
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 font-medium">{page}</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page === pages}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data Lake — baps_dashboard_dados
// ---------------------------------------------------------------------------

const ABA_FILTROS = [
  { label: "Tudo", value: "" },
  { label: "Eventos", value: "evento" },
  { label: "Fluxo de caixa", value: "fluxo" },
  { label: "Saldos", value: "saldo" },
  { label: "Receitas", value: "receita" },
  { label: "Despesas", value: "despesa" },
];

function DataLakeTab() {
  const [abaFiltro, setAbaFiltro] = React.useState("");
  const [page, setPage] = React.useState(1);
  const { totais, porAba, registros, total, pages, loading, error } = useBapsDados(abaFiltro, page);

  React.useEffect(() => { setPage(1); }, [abaFiltro]);

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold">Data Lake — baps_dashboard_dados</h2>
          <p className="text-xs text-muted-foreground">
            {total > 0 ? `${total.toLocaleString("pt-BR")} registros` : "Verificando…"}
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {ABA_FILTROS.map((f) => (
            <button
              key={f.value}
              onClick={() => setAbaFiltro(f.value)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all",
                abaFiltro === f.value
                  ? "bg-foreground text-background"
                  : "bg-foreground/[0.06] hover:bg-foreground/[0.10] text-muted-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI totais da seleção */}
      {totais && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { label: "Receitas", value: totais.receitas, color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Despesas", value: totais.despesas, color: "text-rose-600 dark:text-rose-400" },
            { label: "Saldo", value: totais.saldo, color: totais.saldo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400" },
            { label: "A receber", value: totais.a_receber, color: "text-amber-600 dark:text-amber-400" },
            { label: "A pagar", value: totais.a_pagar, color: "text-blue-600 dark:text-blue-400" },
            { label: "Resultado", value: totais.resultado_projetado, color: totais.resultado_projetado >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="p-3">
              <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
              <p className={cn("text-sm font-semibold tabular-nums", color)}>{fmtBRL(value)}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Agrupamento por aba_origem */}
      {porAba.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/40 bg-foreground/[0.02]">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Origem (aba)</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Receitas</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Despesas</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Saldo</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Campos detectados</th>
              </tr>
            </thead>
            <tbody>
              {porAba.map((aba) => (
                <tr key={aba.aba_origem} className="border-t border-border/30 hover:bg-foreground/[0.02]">
                  <td className="px-3 py-2 font-medium max-w-[200px] truncate" title={aba.aba_origem}>
                    {aba.aba_origem}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {fmtBRL(aba.receitas)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                    {fmtBRL(aba.despesas)}
                  </td>
                  <td className={cn("px-3 py-2 text-right tabular-nums font-semibold",
                    aba.saldo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  )}>
                    {fmtBRL(aba.saldo)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[260px]">
                    <span className="truncate block" title={aba.campos.join(", ")}>
                      {aba.campos.slice(0, 5).join(", ")}{aba.campos.length > 5 ? ` +${aba.campos.length - 5}` : ""}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Registros individuais paginados */}
      <div className="overflow-x-auto rounded-xl border border-border/40">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/40 bg-foreground/[0.02]">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8">#</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Origem</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Data</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Dados (chaves → valores)</th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={4} />)}
            {!loading && registros.length === 0 && !error && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  {total === 0 ? "Tabela baps_dashboard_dados não encontrada ou vazia." : "Nenhum registro neste filtro."}
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-rose-600 dark:text-rose-400 text-xs">
                  Erro ao carregar: {error}
                </td>
              </tr>
            )}
            {registros.map((row) => {
              const financiais = Object.entries(row.dados ?? {})
                .filter(([, v]) => typeof v === "number" || (typeof v === "string" && !isNaN(parseFloat(v.replace(",", ".")))))
                .map(([k, v]) => {
                  const n = parseFloat(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
                  return `${k}: ${isNaN(n) ? v : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
                })
                .slice(0, 6);
              return (
                <tr key={row.id} className="border-t border-border/30 hover:bg-foreground/[0.02]">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.id}</td>
                  <td className="px-3 py-2 font-medium max-w-[180px] truncate" title={row.aba_origem}>
                    {row.aba_origem}
                  </td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap text-muted-foreground">
                    {fmtDate(row.criado_em)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[400px]">
                    <span className="truncate block" title={JSON.stringify(row.dados)}>
                      {financiais.join(" · ") || JSON.stringify(row.dados).slice(0, 120)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Página {page} de {pages} · {total.toLocaleString("pt-BR")} registros</span>
          <div className="flex gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-2.5 py-1 rounded bg-foreground/[0.06] disabled:opacity-40 hover:bg-foreground/[0.11] transition-colors"
            >
              ← Anterior
            </button>
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 rounded bg-foreground/[0.06] disabled:opacity-40 hover:bg-foreground/[0.11] transition-colors"
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Margem por evento
// ---------------------------------------------------------------------------

function MargemTab({ margens, porEvento }: { margens: MargemEdicao[]; porEvento: EventoRow[] }) {
  if (porEvento.length > 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {porEvento.map((ev, idx) => {
          const margemPct = ev.Receita > 0 ? Math.round(((ev.Receita - ev.Despesa) / ev.Receita) * 100) : 0;
          const despesaPct = ev.Receita > 0 ? Math.min(100, Math.round((ev.Despesa / ev.Receita) * 100)) : 0;
          return (
            <motion.div
              key={ev.nome}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, ease: [0.22, 1, 0.36, 1] }}
            >
              <Card className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold tracking-tight truncate">{ev.nome}</div>
                  </div>
                  <Badge
                    variant={margemPct >= 30 ? "success" : margemPct >= 0 ? "warning" : "destructive"}
                    className="tabular-nums shrink-0"
                  >
                    Margem {margemPct}%
                  </Badge>
                </div>

                {/* Progress bar — despesas vs receita */}
                <div className="mb-4 space-y-1.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Despesas ({despesaPct}% da receita)</span>
                    <span className={margemPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                      {margemPct >= 0 ? "✓ Superávit" : "✗ Déficit"}
                    </span>
                  </div>
                  <div className="h-2 bg-foreground/[0.06] rounded-full overflow-hidden">
                    <motion.div
                      className={cn("h-full rounded-full", margemPct >= 30 ? "bg-emerald-500" : margemPct >= 0 ? "bg-amber-500" : "bg-rose-500")}
                      initial={{ width: 0 }}
                      animate={{ width: `${despesaPct}%` }}
                      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Receitas" value={ev.Receita} accent="emerald" />
                  <Stat label="Despesas" value={ev.Despesa} accent="rose" />
                  <Stat
                    label="Resultado"
                    value={ev.resultado}
                    accent={ev.resultado >= 0 ? "emerald" : "rose"}
                  />
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    );
  }

  if (margens.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="space-y-2">
          <div className="text-3xl opacity-20">📊</div>
          <div className="text-sm text-muted-foreground">Nenhum evento encontrado no período selecionado.</div>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {margens.map((m, idx) => {
        const margemPct =
          m.receitaTotal > 0
            ? Math.round(((m.receitaTotal - m.despesaTotal) / m.receitaTotal) * 100)
            : 0;
        const margemValor = m.receitaTotal - m.despesaTotal;
        const despesaPct = m.receitaTotal > 0 ? Math.min(100, Math.round((m.despesaTotal / m.receitaTotal) * 100)) : 0;
        return (
          <motion.div
            key={m.edicao.slug}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold tracking-tight truncate">{m.edicao.nome}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{m.edicao.cidade}</div>
                </div>
                <Badge
                  variant={margemPct >= 30 ? "success" : margemPct >= 0 ? "warning" : "destructive"}
                  className="tabular-nums shrink-0"
                >
                  Margem {margemPct}%
                </Badge>
              </div>

              <div className="mb-4 space-y-1.5">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Despesas ({despesaPct}% da receita)</span>
                  <span className={margemPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                    {margemPct >= 0 ? "✓ Superávit" : "✗ Déficit"}
                  </span>
                </div>
                <div className="h-2 bg-foreground/[0.06] rounded-full overflow-hidden">
                  <motion.div
                    className={cn("h-full rounded-full", margemPct >= 30 ? "bg-emerald-500" : margemPct >= 0 ? "bg-amber-500" : "bg-rose-500")}
                    initial={{ width: 0 }}
                    animate={{ width: `${despesaPct}%` }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Stat label="Receitas vinculadas" value={m.receitasVinculadas} accent="emerald" />
                <Stat label="Despesas vinculadas" value={m.despesasVinculadas} accent="rose" />
                <Stat label="Custo de produção" value={m.edicao.custoProducao} accent="rose" />
                <Stat
                  label="Resultado"
                  value={margemValor}
                  accent={margemValor >= 0 ? "emerald" : "rose"}
                />
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "rose";
}) {
  return (
    <div className="rounded-lg bg-foreground/[0.03] dark:bg-white/[0.03] px-3 py-2 overflow-hidden">
      <div className="text-[10px] text-muted-foreground truncate">{label}</div>
      <div
        className={cn(
          "text-sm font-semibold tabular-nums truncate",
          accent === "emerald" && "text-emerald-600 dark:text-emerald-400",
          accent === "rose" && "text-rose-600 dark:text-rose-400",
        )}
        title={formatCurrencyBRL(value)}
      >
        {fmtCompact(value)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function MoneyTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-background shadow-xl px-3 py-2.5 text-xs min-w-[160px]">
      <div className="text-[11px] font-medium text-muted-foreground mb-2">{label}</div>
      <div className="space-y-1.5">
        {payload.map((p: any) => (
          <div key={p.dataKey ?? p.name} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
              <span className="text-muted-foreground">{p.name ?? p.dataKey}</span>
            </span>
            <span className="font-semibold tabular-nums">{formatCurrencyBRL(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type Totals = {
  saldoConferido: number;
  aReceber: number;
  aReceberCount: number;
  aPagar: number;
  aPagarCount: number;
  resultadoProjetado: number;
  entradasPeriodo: number;
  saidasPeriodo: number;
};

function computeTotals(financeiro: FinanceLancamento[]): Totals {
  let entradas = 0;
  let saidas = 0;
  let aReceber = 0;
  let aReceberCount = 0;
  let aPagar = 0;
  let aPagarCount = 0;

  for (const f of financeiro) {
    if (f.tipo === "receita") {
      if (f.pagamento) entradas += f.valor;
      else { aReceber += f.valor; aReceberCount += 1; }
    } else {
      if (f.pagamento) saidas += f.valor;
      else { aPagar += f.valor; aPagarCount += 1; }
    }
  }

  return {
    saldoConferido: entradas - saidas,
    aReceber,
    aReceberCount,
    aPagar,
    aPagarCount,
    resultadoProjetado: entradas - saidas + aReceber - aPagar,
    entradasPeriodo: entradas,
    saidasPeriodo: saidas,
  };
}

type FluxoMensal = {
  mes: string;
  chave?: string;
  entradas: number;
  saidas: number;
  saldo: number;
  acumulado: number;
};

function computeFluxoMensal(financeiro: FinanceLancamento[]): FluxoMensal[] {
  const map = new Map<string, { entradas: number; saidas: number }>();
  for (const f of financeiro) {
    if (!f.pagamento) continue;
    const key = f.pagamento.slice(0, 7);
    const cur = map.get(key) ?? { entradas: 0, saidas: 0 };
    if (f.tipo === "receita") cur.entradas += f.valor;
    else cur.saidas += f.valor;
    map.set(key, cur);
  }
  let acumulado = 0;
  return Array.from(map.keys())
    .sort()
    .map((k) => {
      const { entradas, saidas } = map.get(k)!;
      const saldo = entradas - saidas;
      acumulado += saldo;
      const [ano, mes] = k.split("-");
      const label = `${MESES_PT[Number(mes) - 1] ?? mes}/${ano.slice(2)}`;
      return { mes: label, chave: k, entradas, saidas, saldo, acumulado };
    });
}

type MargemEdicao = {
  edicao: ReturnType<typeof useAppState>["state"]["edicoes"][number];
  receitaIngressos: number;
  receitaTotal: number;
  receitasVinculadas: number;
  despesasVinculadas: number;
  despesaTotal: number;
};

function computeMargensPorEdicao(
  edicoes: ReturnType<typeof useAppState>["state"]["edicoes"],
  financeiro: FinanceLancamento[],
): MargemEdicao[] {
  return edicoes.map((edicao) => {
    const m = metricasEdicao(edicao);
    const vinculadas = financeiro.filter((f) => f.edicaoSlug === edicao.slug);
    const receitasVinculadas = vinculadas
      .filter((f) => f.tipo === "receita")
      .reduce((a, f) => a + f.valor, 0);
    const despesasVinculadas = vinculadas
      .filter((f) => f.tipo === "despesa")
      .reduce((a, f) => a + f.valor, 0);
    return {
      edicao,
      receitaIngressos: m.receitaIngressos,
      receitaTotal: m.receitaTotal,
      receitasVinculadas,
      despesasVinculadas,
      despesaTotal: edicao.custoProducao + despesasVinculadas,
    };
  });
}

function formatDateBR(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(2)}`;
}
