"use client";

import * as React from "react";
import { motion } from "framer-motion";
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
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  FileSpreadsheet,
  PencilLine,
  Plus,
  Receipt,
  Search,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, type SelectOption } from "@/components/ui/select";
import { AutoConciliacaoSheet } from "@/components/dashboard/auto-conciliacao-sheet";
import { PortalFinanceiroTabs } from "@/components/financeiro/portal-financeiro-tabs";
import { SheetsSyncPanel } from "@/components/financeiro/sheets-sync-panel";
import {
  type FinanceLancamento,
  metricasEdicao,
  useAppState,
} from "@/lib/app-state";
import { useRegisterPageState } from "@/lib/page-state";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import { todayBrasilia } from "@/lib/timezone";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const ANOS = ["2022", "2023", "2024", "2025", "2026"];

// ---------------------------------------------------------------------------
// Compact BRL — prevents number overflow inside KPI cards
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

    // Supabase Realtime — atualiza automaticamente quando dados mudam no banco
    const sb = getSupabaseBrowser();
    const channel = sb
      ?.channel("lancamentos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "portal_lancamentos" }, fetchData)
      .subscribe();

    window.addEventListener("portal:data-updated", fetchData);
    return () => {
      channel?.unsubscribe();
      window.removeEventListener("portal:data-updated", fetchData);
    };
  }, [fetchData]);

  return { fluxoSupabase, porEvento, totaisSupabase, updatedAt };
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
            "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap",
            value === a
              ? "bg-foreground text-background"
              : "bg-foreground/[0.06] hover:bg-foreground/[0.11] text-muted-foreground",
          )}
        >
          {a || "Todos"}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// XLSX Import Panel
// ---------------------------------------------------------------------------

interface ImportRow {
  chave: string;
  entradas: number;
  saidas: number;
}

function ImportarPlanilhaPanel({
  onImport,
  onReset,
}: {
  onImport: (rows: ImportRow[]) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [sheets, setSheets] = React.useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = React.useState("");
  const [allRows, setAllRows] = React.useState<any[][]>([]);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [previewRows, setPreviewRows] = React.useState<any[][]>([]);
  const [colMes, setColMes] = React.useState("");
  const [colEntradas, setColEntradas] = React.useState("");
  const [colSaidas, setColSaidas] = React.useState("");
  const [aggregated, setAggregated] = React.useState<ImportRow[]>([]);
  const [imported, setImported] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const parseNumber = (v: any): number => {
    if (v == null || v === "") return 0;
    const n = parseFloat(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  };

  const toMonthKey = (v: any): string => {
    const s = String(v ?? "").trim();
    // Already YYYY-MM
    if (/^\d{4}-\d{2}$/.test(s)) return s;
    // Try to parse as date
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      return `${y}-${m}`;
    }
    // DD/MM/YYYY or MM/YYYY
    const parts = s.split(/[/\-\.]/);
    if (parts.length === 3) {
      // assume DD/MM/YYYY or YYYY/MM/DD
      const [a, b, c] = parts;
      if (a.length === 4) return `${a}-${b.padStart(2, "0")}`;
      return `${c}-${b.padStart(2, "0")}`;
    }
    if (parts.length === 2 && parts[1].length === 4) {
      return `${parts[1]}-${parts[0].padStart(2, "0")}`;
    }
    return s;
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset state
    setSheets([]);
    setSelectedSheet("");
    setAllRows([]);
    setHeaders([]);
    setPreviewRows([]);
    setColMes("");
    setColEntradas("");
    setColSaidas("");
    setAggregated([]);
    setImported(false);

    const XLSX = await import("xlsx");
    const isCsv = file.name.toLowerCase().endsWith(".csv");
    let wb: any;

    if (isCsv) {
      const text = await file.text();
      wb = XLSX.read(text, { type: "string" });
    } else {
      const buf = await file.arrayBuffer();
      wb = XLSX.read(buf, { type: "array" });
    }

    const sheetNames: string[] = wb.SheetNames;
    setSheets(sheetNames);
    const first = sheetNames[0] ?? "";
    setSelectedSheet(first);
    loadSheet(XLSX, wb, first);
  };

  const loadSheet = (XLSX: any, wb: any, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    const hdrs: string[] = (data[0] ?? []).map(String);
    const rows = data.slice(1).filter((r: any[]) => r.some((c) => c !== ""));
    setHeaders(hdrs);
    setAllRows(rows);
    setPreviewRows(rows.slice(0, 3));
    // Auto-detect columns by header name hints
    const lower = hdrs.map((h) => h.toLowerCase());
    const guessIdx = (keywords: string[]) => {
      for (const kw of keywords) {
        const i = lower.findIndex((h) => h.includes(kw));
        if (i >= 0) return hdrs[i];
      }
      return "";
    };
    setColMes(guessIdx(["mês", "mes", "data", "month", "período", "periodo"]));
    setColEntradas(guessIdx(["entrada", "receita", "crédito", "credito", "income", "credit"]));
    setColSaidas(guessIdx(["saída", "saida", "despesa", "débito", "debito", "expense", "debit"]));
  };

  // Re-aggregate when column mapping changes
  React.useEffect(() => {
    if (!colMes || !allRows.length) { setAggregated([]); return; }
    const mesIdx = headers.indexOf(colMes);
    const entIdx = headers.indexOf(colEntradas);
    const saiIdx = headers.indexOf(colSaidas);

    const map = new Map<string, { entradas: number; saidas: number }>();
    for (const row of allRows) {
      const key = toMonthKey(row[mesIdx]);
      if (!key || key.length < 4) continue;
      const cur = map.get(key) ?? { entradas: 0, saidas: 0 };
      if (entIdx >= 0) cur.entradas += parseNumber(row[entIdx]);
      if (saiIdx >= 0) cur.saidas += parseNumber(row[saiIdx]);
      map.set(key, cur);
    }
    const result: ImportRow[] = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chave, { entradas, saidas }]) => ({ chave, entradas, saidas }));
    setAggregated(result);
  }, [colMes, colEntradas, colSaidas, allRows, headers]);

  const handleImport = () => {
    onImport(aggregated);
    setImported(true);
    setOpen(false);
  };

  const handleReset = () => {
    onReset();
    setImported(false);
    setSheets([]);
    setAllRows([]);
    setHeaders([]);
    setPreviewRows([]);
    setAggregated([]);
  };

  const colOptions: SelectOption[] = [
    { value: "", label: "— selecione —" },
    ...headers.map((h) => ({ value: h, label: h })),
  ];

  const sheetOptions: SelectOption[] = sheets.map((s) => ({ value: s, label: s }));

  return (
    <div className="rounded-xl border border-border/60 bg-foreground/[0.01] dark:bg-white/[0.01] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-foreground/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Importar planilha</span>
          {imported && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              · dados importados
            </span>
          )}
        </div>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/40">
          {/* File picker */}
          <div className="pt-4 flex items-center gap-3 flex-wrap">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              className="gap-2"
            >
              <Upload className="h-3.5 w-3.5" />
              Selecionar arquivo (.xlsx, .csv)
            </Button>
            {imported && (
              <button
                onClick={handleReset}
                className="text-xs text-muted-foreground hover:text-rose-500 transition-colors flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Limpar dados importados
              </button>
            )}
          </div>

          {/* Sheet selector (if multiple sheets) */}
          {sheets.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Aba:</span>
              <Select
                value={selectedSheet}
                onValueChange={async (v) => {
                  setSelectedSheet(v);
                  const XLSX = await import("xlsx");
                  // We need to re-read the workbook — store it in a ref
                }}
                options={sheetOptions}
                triggerClassName="min-w-[160px] h-8 text-xs"
              />
            </div>
          )}

          {/* Preview table */}
          {headers.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">
                Primeiras linhas da planilha:
              </div>
              <div className="overflow-x-auto rounded-lg border border-border/50">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-foreground/[0.03]">
                      {headers.map((h) => (
                        <th key={h} className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, ri) => (
                      <tr key={ri} className="border-t border-border/30">
                        {headers.map((_, ci) => (
                          <td key={ci} className="px-2 py-1.5 text-muted-foreground whitespace-nowrap max-w-[140px] truncate">
                            {String(row[ci] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Column mapping */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Mês / Data</label>
                  <Select value={colMes} onValueChange={setColMes} options={colOptions} triggerClassName="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Entradas (Receita)</label>
                  <Select value={colEntradas} onValueChange={setColEntradas} options={colOptions} triggerClassName="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Saídas (Despesa)</label>
                  <Select value={colSaidas} onValueChange={setColSaidas} options={colOptions} triggerClassName="h-8 text-xs" />
                </div>
              </div>
            </div>
          )}

          {/* Aggregated preview */}
          {aggregated.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                Resultado agregado por mês ({aggregated.length} meses):
              </div>
              <div className="max-h-[200px] overflow-y-auto rounded-lg border border-border/50">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr className="bg-foreground/[0.03]">
                      {["Mês", "Entradas", "Saídas", "Saldo"].map((h, i) => (
                        <th key={h} className={cn("px-2 py-1.5 font-medium text-muted-foreground", i === 0 ? "text-left" : "text-right")}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aggregated.map((r) => (
                      <tr key={r.chave} className="border-t border-border/30">
                        <td className="px-2 py-1 font-medium">{r.chave}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                          {fmtCompact(r.entradas)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-rose-600 dark:text-rose-400">
                          {fmtCompact(r.saidas)}
                        </td>
                        <td className={cn("px-2 py-1 text-right tabular-nums font-semibold", r.entradas - r.saidas >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                          {fmtCompact(r.entradas - r.saidas)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button size="sm" onClick={handleImport} className="gap-2">
                <Check className="h-3.5 w-3.5" />
                Importar {aggregated.length} meses
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FinanceiroPage() {
  const { state } = useAppState();
  const [anoFiltro, setAnoFiltro] = React.useState<string>("");
  const [activeTab, setActiveTab] = React.useState("overview");

  const { fluxoSupabase, porEvento, totaisSupabase, updatedAt } = useLancamentosFluxo(anoFiltro);
  const totalCount = useTotalCount(anoFiltro);

  const totals = React.useMemo(() => computeTotals(state.financeiro), [state.financeiro]);
  const margens = React.useMemo(
    () => computeMargensPorEdicao(state.edicoes, state.financeiro),
    [state.edicoes, state.financeiro],
  );

  // Fluxo mensal vem direto do Supabase (sem override localStorage)
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

  // Totais vêm do Supabase diretamente
  const displayTotals: Totals = {
    saldoConferido: totaisSupabase?.saldo_realizado ?? autoTotais.entradasPeriodo - autoTotais.saidasPeriodo,
    aReceber: totaisSupabase?.total_a_receber ?? totals.aReceber,
    aReceberCount: totals.aReceberCount,
    aPagar: totaisSupabase?.total_a_pagar ?? totals.aPagar,
    aPagarCount: totals.aPagarCount,
    resultadoProjetado: totaisSupabase?.resultado_projetado ?? totals.resultadoProjetado,
    entradasPeriodo: autoTotais.entradasPeriodo,
    saidasPeriodo: autoTotais.saidasPeriodo,
  };

  useRegisterPageState({
    module: "Financeiro",
    summary: [
      { label: "Ainda vou receber", value: formatCurrencyBRL(displayTotals.aReceber) },
      { label: "Ainda tenho que pagar", value: formatCurrencyBRL(displayTotals.aPagar) },
      { label: "Dinheiro em caixa", value: formatCurrencyBRL(displayTotals.saldoConferido) },
      { label: "O que sobra no final", value: formatCurrencyBRL(displayTotals.resultadoProjetado) },
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
          <AnoSelector value={anoFiltro} onChange={setAnoFiltro} />
          <AutoConciliacaoSheet />
        </div>
      </motion.div>

      <KpiGrid
        totals={displayTotals}
        onVerDetalhes={setActiveTab}
      />

      <PortalFinanceiroTabs />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Resumo</TabsTrigger>
          <TabsTrigger value="fluxo">Mês a mês</TabsTrigger>
          <TabsTrigger value="receber">Ainda vou receber</TabsTrigger>
          <TabsTrigger value="pagar">Ainda tenho que pagar</TabsTrigger>
          <TabsTrigger value="margem">Resultado por evento</TabsTrigger>
          <TabsTrigger value="egestor">Atualizar dados</TabsTrigger>
        </TabsList>

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

        <TabsContent value="egestor" className="mt-2">
          <SheetsSyncPanel />
        </TabsContent>
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
}: {
  totals: Totals;
  onVerDetalhes: (tab: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        label="Dinheiro em caixa"
        value={totals.saldoConferido}
        hint="O que entrou menos o que saiu"
        icon={<Wallet className="h-3.5 w-3.5" />}
        onDetalhes={() => onVerDetalhes("fluxo")}
      />
      <KpiCard
        label="Ainda vou receber"
        value={totals.aReceber}
        hint="Valores que ainda não chegaram"
        icon={<ArrowDownRight className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
        accent="emerald"
        onDetalhes={() => onVerDetalhes("receber")}
      />
      <KpiCard
        label="Ainda tenho que pagar"
        value={totals.aPagar}
        hint="Valores que ainda vou pagar"
        icon={<ArrowUpRight className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />}
        accent="rose"
        onDetalhes={() => onVerDetalhes("pagar")}
      />
      <KpiCard
        label="O que sobra no final"
        value={totals.resultadoProjetado}
        hint="Se tudo entrar e tudo sair conforme previsto"
        icon={<Receipt className="h-3.5 w-3.5" />}
        accent={totals.resultadoProjetado >= 0 ? "emerald" : "rose"}
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
  onDetalhes,
}: {
  label: string;
  value: number;
  hint?: string;
  icon?: React.ReactNode;
  accent?: "emerald" | "rose";
  onDetalhes?: () => void;
}) {
  return (
    <Card className="p-4 overflow-hidden flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium text-muted-foreground tracking-tight leading-tight truncate">
            {label}
          </div>
          {hint && (
            <div className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{hint}</div>
          )}
        </div>
        {icon && (
          <div className="h-7 w-7 rounded-lg bg-foreground/[0.05] dark:bg-white/[0.06] grid place-items-center text-muted-foreground shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div
        className={cn(
          "text-[22px] font-semibold tracking-tight tabular-nums leading-none truncate",
          accent === "emerald" && "text-emerald-600 dark:text-emerald-400",
          accent === "rose" && "text-rose-600 dark:text-rose-400",
        )}
        title={formatCurrencyBRL(value)}
      >
        {fmtCompact(value)}
      </div>

      {onDetalhes && (
        <button
          onClick={onDetalhes}
          className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors leading-none text-left"
        >
          Ver detalhes →
        </button>
      )}
    </Card>
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
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <div>
            <div className="text-sm font-semibold tracking-tight">
              Dinheiro que entrou e saiu{ano ? ` — ${ano}` : ""}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Movimentações já realizadas
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <Legend dot="bg-emerald-500" label="Entrou" />
            <Legend dot="bg-rose-500" label="Saiu" />
            <Legend dot="bg-foreground" label="Saldo" />
          </div>
        </div>
        {fluxoMensal.length === 0 ? (
          <div className="h-[280px] grid place-items-center text-xs text-muted-foreground">
            Sem movimentações liquidadas no período selecionado.
          </div>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fluxoMensal} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-entradas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(16,185,129)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="rgb(16,185,129)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-saidas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(244,63,94)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="rgb(244,63,94)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-saldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
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
                <Tooltip content={<MoneyTip />} cursor={{ stroke: "hsl(var(--border))" }} />
                <Area type="monotone" dataKey="entradas" stroke="rgb(16,185,129)" strokeWidth={2} fill="url(#grad-entradas)" />
                <Area type="monotone" dataKey="saidas" stroke="rgb(244,63,94)" strokeWidth={2} fill="url(#grad-saidas)" />
                <Area type="monotone" dataKey="saldo" stroke="hsl(var(--foreground))" strokeWidth={2} fill="url(#grad-saldo)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-3">
        <Card className="p-5">
          <div className="text-sm font-semibold tracking-tight mb-1">Resultado por evento</div>
          <div className="text-[11px] text-muted-foreground mb-3">
            O que entrou e o que saiu em cada evento
          </div>
          {barData.length === 0 ? (
            <div className="h-[260px] grid place-items-center text-xs text-muted-foreground">
              Sem eventos nas movimentações do período.
            </div>
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="bar-receita-fin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--brand-2))" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="hsl(var(--brand-1))" stopOpacity={0.6} />
                    </linearGradient>
                    <linearGradient id="bar-despesa-fin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(244,63,94)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="rgb(244,63,94)" stopOpacity={0.18} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
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
                  <Tooltip content={<MoneyTip />} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
                  <Bar dataKey="Receita" fill="url(#bar-receita-fin)" radius={[8, 8, 4, 4]} />
                  <Bar dataKey="Despesa" fill="url(#bar-despesa-fin)" radius={[8, 8, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold tracking-tight mb-2">O que vence em breve</div>
          <ProximosVencimentos />
        </Card>
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
      <div className="text-xs text-muted-foreground text-center py-6">
        Sem lançamentos em aberto. Tudo conciliado.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {proximos.map((l) => {
        const atrasado = l.vencimento < hoje;
        return (
          <div
            key={l.id}
            className="flex items-center gap-2 rounded-xl border border-border/50 bg-foreground/[0.02] dark:bg-white/[0.03] px-3 py-2"
          >
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                l.tipo === "receita" ? "bg-emerald-500" : "bg-rose-500",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate">{l.descricao}</div>
              <div className="text-[10px] text-muted-foreground">
                Vence em {formatDateBR(l.vencimento)}
                {atrasado && <span className="ml-1.5 text-rose-500">· atrasado</span>}
              </div>
            </div>
            <div
              className={cn(
                "text-sm font-semibold tabular-nums shrink-0",
                l.tipo === "receita"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground/80",
              )}
            >
              {l.tipo === "receita" ? "+" : "−"}{formatCurrencyBRL(l.valor).replace("R$", "R$ ")}
            </div>
            <button
              onClick={() => togglePago(l.id, true)}
              className="h-7 w-7 grid place-items-center rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10"
              aria-label="Marcar como liquidado"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fluxo de caixa — editable table
// ---------------------------------------------------------------------------

interface EditableFluxoRow extends FluxoMensal {
  chave: string;
}

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
          label="Total que entrou"
          value={totals.entradasPeriodo}
          hint="Tudo que foi recebido no período"
          icon={<ArrowDownRight className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
          accent="emerald"
        />
        <KpiCard
          label="Total que saiu"
          value={totals.saidasPeriodo}
          hint="Tudo que foi pago no período"
          icon={<ArrowUpRight className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />}
          accent="rose"
        />
        <KpiCard
          label="Resultado do período"
          value={totals.entradasPeriodo - totals.saidasPeriodo}
          hint="O que entrou menos o que saiu"
          icon={<Wallet className="h-3.5 w-3.5" />}
          accent={totals.entradasPeriodo - totals.saidasPeriodo >= 0 ? "emerald" : "rose"}
        />
      </div>

      <Card className="p-5">
        <div className="text-sm font-semibold tracking-tight mb-3">Mês a mês</div>

        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-foreground/[0.02] dark:bg-white/[0.02]">
                {["Mês", "Entrou", "Saiu", "Resultado do mês", "Acumulado no ano"].map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium",
                      i === 0 ? "text-left" : "text-right",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fluxoMensal.map((row) => {
                const key = (row as any).chave ?? row.mes;
                return (
                  <tr key={key} className="border-t border-border/50">
                    <td className="px-3 py-2 font-medium">{row.mes || key}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatCurrencyBRL(row.entradas)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                      {formatCurrencyBRL(row.saidas)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyBRL(row.saldo)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {formatCurrencyBRL(row.acumulado)}
                    </td>
                  </tr>
                );
              })}

              {fluxoMensal.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                    Sem movimentações no período selecionado.
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

  const titulo = recDesp === "Receitas" ? "Ainda vou receber" : "Ainda tenho que pagar";
  const cor = recDesp === "Receitas" ? "emerald" : "rose";

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
          { value: "A receber", label: "Ainda não recebi" },
          { value: "Recebido", label: "Já recebi" },
        ]
      : [
          { value: "", label: "Todos" },
          { value: "A pagar", label: "Ainda não paguei" },
          { value: "Pago", label: "Já paguei" },
        ];

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-sm font-semibold tracking-tight">{titulo}</div>
            <div className="text-[11px] text-muted-foreground">
              {total.toLocaleString("pt-BR")} registros
              {ano ? ` em ${ano}` : " · todos os anos"} · sistema financeiro
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
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
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-foreground/[0.02] dark:bg-white/[0.02]">
                {[
                  ["left", "Status"],
                  ["left", "Nome / Descrição"],
                  ["left", "Evento"],
                  ["left", "Vencimento"],
                  ["left", "Pagamento"],
                  ["right", "Valor"],
                ].map(([align, label]) => (
                  <th
                    key={label}
                    className={cn(
                      "px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium",
                      `text-${align}`,
                    )}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center text-xs text-muted-foreground py-10">
                    Carregando…
                  </td>
                </tr>
              )}
              {!loading && lancamentos.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-xs text-muted-foreground py-10">
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              )}
              {!loading &&
                lancamentos.map((l) => {
                  const pago = l.situacao === "Recebido" || l.situacao === "Pago";
                  return (
                    <tr key={l.id} className="border-t border-border/50">
                      <td className="px-3 py-2.5">
                        <Badge variant={pago ? "success" : "warning"} className="gap-1">
                          <CircleDot className="h-3 w-3" />
                          {l.situacao ?? "—"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 max-w-[240px]">
                        <div className="text-sm font-medium truncate">
                          {l.nome_razao_social || l.descricao || "—"}
                        </div>
                        {l.classificacao && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            {l.classificacao}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[160px]">
                        <div className="truncate">{l.evento || "—"}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {formatDateBR(l.data_vencimento ?? "")}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {l.data_pagamento ? (
                          formatDateBR(l.data_pagamento)
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2.5 text-right font-semibold tabular-nums text-sm",
                          cor === "emerald"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-foreground/85",
                        )}
                      >
                        {recDesp === "Receitas" ? "+" : "−"}
                        {formatCurrencyBRL(Number(l.valor) || 0).replace("R$", "R$ ")}
                      </td>
                    </tr>
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
// Margem por evento
// ---------------------------------------------------------------------------

function MargemTab({ margens, porEvento }: { margens: MargemEdicao[]; porEvento: EventoRow[] }) {
  if (porEvento.length > 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {porEvento.map((ev) => {
          const margemPct =
            ev.Receita > 0 ? Math.round(((ev.Receita - ev.Despesa) / ev.Receita) * 100) : 0;
          return (
            <Card key={ev.nome} className="p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
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
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Stat label="Receitas" value={ev.Receita} accent="emerald" />
                <Stat label="Despesas" value={ev.Despesa} accent="rose" />
                <Stat
                  label="Resultado"
                  value={ev.resultado}
                  accent={ev.resultado >= 0 ? "emerald" : "rose"}
                />
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  if (margens.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        Nenhum evento encontrado no período selecionado.
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {margens.map((m) => {
        const margemPct =
          m.receitaTotal > 0
            ? Math.round(((m.receitaTotal - m.despesaTotal) / m.receitaTotal) * 100)
            : 0;
        const margemValor = m.receitaTotal - m.despesaTotal;
        return (
          <Card key={m.edicao.slug} className="p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
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
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat label="O que entrou" value={m.receitasVinculadas} accent="emerald" />
              <Stat label="O que saiu" value={m.despesasVinculadas} accent="rose" />
              <Stat label="Custo de produção" value={m.edicao.custoProducao} accent="rose" />
              <Stat
                label="Resultado"
                value={margemValor}
                accent={margemValor >= 0 ? "emerald" : "rose"}
              />
            </div>
          </Card>
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
    <div className="rounded-xl glass-strong px-3 py-2 text-xs shadow-xl">
      <div className="text-[11px] text-muted-foreground mb-1.5">{label}</div>
      <div className="space-y-1">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-6">
            <span className="capitalize text-muted-foreground">{p.dataKey ?? p.name}</span>
            <span className="font-medium tabular-nums">{formatCurrencyBRL(p.value)}</span>
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
