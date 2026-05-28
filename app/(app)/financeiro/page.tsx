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
  CalendarRange,
  CheckCircle2,
  CircleDot,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Wallet,
  Search,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, type SelectOption } from "@/components/ui/select";
import { AutoConciliacaoSheet } from "@/components/dashboard/auto-conciliacao-sheet";
import { LancamentoFormDialog } from "@/components/dashboard/lancamento-form-dialog";
import { PortalFinanceiroTabs } from "@/components/financeiro/portal-financeiro-tabs";
import { SheetsSyncPanel } from "@/components/financeiro/sheets-sync-panel";
import {
  type FinanceLancamento,
  metricasEdicao,
  useAppState,
} from "@/lib/app-state";
import { useRegisterPageState } from "@/lib/page-state";
import { cn, formatCurrencyBRL, formatNumberBR } from "@/lib/utils";

const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type LancStatusFilter = "todos" | "pago" | "aberto";

export default function FinanceiroPage() {
  const { state } = useAppState();

  const totals = React.useMemo(() => computeTotals(state.financeiro), [state.financeiro]);
  const fluxoMensal = React.useMemo(() => computeFluxoMensal(state.financeiro), [state.financeiro]);
  const margens = React.useMemo(
    () => computeMargensPorEdicao(state.edicoes, state.financeiro),
    [state.edicoes, state.financeiro],
  );

  useRegisterPageState({
    module: "Financeiro",
    summary: [
      { label: "A receber (em aberto)", value: formatCurrencyBRL(totals.aReceber) },
      { label: "A pagar (em aberto)", value: formatCurrencyBRL(totals.aPagar) },
      { label: "Saldo conferido", value: formatCurrencyBRL(totals.saldoConferido) },
      { label: "Resultado projetado", value: formatCurrencyBRL(totals.resultadoProjetado) },
    ],
  });

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-end justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Financeiro</h1>
          <p className="text-xs text-muted-foreground">
            Fluxo de caixa, contas a pagar e a receber, margem por edição e auto-conciliação bancária
          </p>
        </div>
        <AutoConciliacaoSheet />
      </motion.div>

      <KpiGrid totals={totals} />

      <PortalFinanceiroTabs />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de caixa</TabsTrigger>
          <TabsTrigger value="receber">Contas a receber</TabsTrigger>
          <TabsTrigger value="pagar">Contas a pagar</TabsTrigger>
          <TabsTrigger value="margem">Margem por evento</TabsTrigger>
          <TabsTrigger value="egestor">Atualizar dados</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-2">
          <OverviewTab totals={totals} fluxoMensal={fluxoMensal} margens={margens} />
        </TabsContent>

        <TabsContent value="fluxo" className="mt-2">
          <FluxoTab fluxoMensal={fluxoMensal} totals={totals} />
        </TabsContent>

        <TabsContent value="receber" className="mt-2">
          <LancamentosTab tipo="receita" />
        </TabsContent>

        <TabsContent value="pagar" className="mt-2">
          <LancamentosTab tipo="despesa" />
        </TabsContent>

        <TabsContent value="margem" className="mt-2">
          <MargemTab margens={margens} />
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

function KpiGrid({ totals }: { totals: Totals }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        label="Saldo conferido"
        value={totals.saldoConferido}
        hint="Recebimentos pagos − pagamentos efetuados"
        icon={<Wallet className="h-3.5 w-3.5" />}
      />
      <KpiCard
        label="A receber"
        value={totals.aReceber}
        hint={`${totals.aReceberCount} lançamentos em aberto`}
        icon={<ArrowDownRight className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
        accent="emerald"
      />
      <KpiCard
        label="A pagar"
        value={totals.aPagar}
        hint={`${totals.aPagarCount} lançamentos em aberto`}
        icon={<ArrowUpRight className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />}
        accent="rose"
      />
      <KpiCard
        label="Resultado projetado"
        value={totals.resultadoProjetado}
        hint="Saldo conferido + a receber − a pagar"
        icon={<Receipt className="h-3.5 w-3.5" />}
        accent={totals.resultadoProjetado >= 0 ? "emerald" : "rose"}
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
}: {
  label: string;
  value: number;
  hint?: string;
  icon?: React.ReactNode;
  accent?: "emerald" | "rose";
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[12px] font-medium text-muted-foreground tracking-tight">
            {label}
          </div>
          {hint && <div className="text-[11px] text-muted-foreground/70 mt-0.5">{hint}</div>}
        </div>
        {icon && (
          <div className="h-7 w-7 rounded-lg bg-foreground/[0.05] dark:bg-white/[0.06] grid place-items-center text-muted-foreground">
            {icon}
          </div>
        )}
      </div>
      <div
        className={cn(
          "mt-4 text-[24px] font-semibold tracking-tight tabular-nums leading-none",
          accent === "emerald" && "text-emerald-600 dark:text-emerald-400",
          accent === "rose" && "text-rose-600 dark:text-rose-400",
        )}
      >
        {formatCurrencyBRL(value)}
      </div>
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
}: {
  totals: Totals;
  fluxoMensal: FluxoMensal[];
  margens: MargemEdicao[];
}) {
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <div>
            <div className="text-sm font-semibold tracking-tight">Fluxo de caixa nos últimos meses</div>
            <div className="text-[11px] text-muted-foreground">
              Entradas, saídas e saldo do período · valores realizados
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <Legend dot="bg-emerald-500" label="Entradas" />
            <Legend dot="bg-rose-500" label="Saídas" />
            <Legend dot="bg-foreground" label="Saldo" />
          </div>
        </div>
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
              <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} width={48} />
              <Tooltip content={<MoneyTip />} cursor={{ stroke: "hsl(var(--border))" }} />
              <Area type="monotone" dataKey="entradas" stroke="rgb(16,185,129)" strokeWidth={2} fill="url(#grad-entradas)" />
              <Area type="monotone" dataKey="saidas" stroke="rgb(244,63,94)" strokeWidth={2} fill="url(#grad-saidas)" />
              <Area type="monotone" dataKey="saldo" stroke="hsl(var(--foreground))" strokeWidth={2} fill="url(#grad-saldo)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-3">
        <Card className="p-5">
          <div className="text-sm font-semibold tracking-tight mb-1">Resultado por edição</div>
          <div className="text-[11px] text-muted-foreground mb-3">
            Receita total (ingressos + patrocínios) versus despesas alocadas
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={margens.map((m) => ({ nome: m.edicao.nome, Receita: m.receitaTotal, Despesa: m.despesaTotal }))}
                margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
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
                <XAxis dataKey="nome" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false}
                  tickFormatter={(v) => (String(v).length > 18 ? `${String(v).slice(0, 16)}…` : String(v))} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} />
                <Tooltip content={<MoneyTip />} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
                <Bar dataKey="Receita" fill="url(#bar-receita-fin)" radius={[8, 8, 4, 4]} />
                <Bar dataKey="Despesa" fill="url(#bar-despesa-fin)" radius={[8, 8, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold tracking-tight mb-2">Próximos vencimentos</div>
          <ProximosVencimentos />
        </Card>
      </div>
    </div>
  );
}

function ProximosVencimentos() {
  const { state, togglePago } = useAppState();
  const hoje = new Date().toISOString().slice(0, 10);
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
                "h-2 w-2 rounded-full",
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
            <div className={cn("text-sm font-semibold tabular-nums shrink-0", l.tipo === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/80")}>
              {l.tipo === "receita" ? "+" : "−"}{formatCurrencyBRL(l.valor).replace("R$", "R$\u00a0")}
            </div>
            <button
              onClick={() => togglePago(l.id, true)}
              className="h-7 w-7 grid place-items-center rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10"
              aria-label="Marcar como liquidado"
              title="Marcar como liquidado"
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
// Fluxo de caixa
// ---------------------------------------------------------------------------

function FluxoTab({ fluxoMensal, totals }: { fluxoMensal: FluxoMensal[]; totals: Totals }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Total entradas (período)" value={totals.entradasPeriodo} hint="Recebimentos liquidados" icon={<ArrowDownRight className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />} accent="emerald" />
        <KpiCard label="Total saídas (período)" value={totals.saidasPeriodo} hint="Pagamentos efetuados" icon={<ArrowUpRight className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />} accent="rose" />
        <KpiCard label="Saldo do período" value={totals.entradasPeriodo - totals.saidasPeriodo} hint="Resultado realizado" icon={<Wallet className="h-3.5 w-3.5" />} />
      </div>

      <Card className="p-5">
        <div className="text-sm font-semibold tracking-tight mb-3">Fluxo mês a mês</div>
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-foreground/[0.02] dark:bg-white/[0.02]">
                <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Mês</th>
                <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Entradas</th>
                <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Saídas</th>
                <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Saldo do mês</th>
                <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Saldo acumulado</th>
              </tr>
            </thead>
            <tbody>
              {fluxoMensal.map((row) => (
                <tr key={row.mes} className="border-t border-border/50">
                  <td className="px-3 py-2 font-medium">{row.mes}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrencyBRL(row.entradas)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">{formatCurrencyBRL(row.saidas)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyBRL(row.saldo)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrencyBRL(row.acumulado)}</td>
                </tr>
              ))}
              {fluxoMensal.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                    Sem movimentações registradas ainda.
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
// Lançamentos (a pagar / a receber)
// ---------------------------------------------------------------------------

function LancamentosTab({ tipo }: { tipo: "receita" | "despesa" }) {
  const { state, togglePago, removeLancamento } = useAppState();
  const [busca, setBusca] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<LancStatusFilter>("todos");
  const [edicaoFilter, setEdicaoFilter] = React.useState<string>("todas");
  const [dialog, setDialog] = React.useState<
    | { open: true; mode: "create" }
    | { open: true; mode: "edit"; id: string }
    | { open: false }
  >({ open: false });

  const lista = React.useMemo(() => {
    return state.financeiro
      .filter((f) => f.tipo === tipo)
      .filter((f) => (statusFilter === "todos" ? true : statusFilter === "pago" ? !!f.pagamento : !f.pagamento))
      .filter((f) => (edicaoFilter === "todas" ? true : edicaoFilter === "none" ? !f.edicaoSlug : f.edicaoSlug === edicaoFilter))
      .filter((f) => (busca.trim() === "" ? true : `${f.descricao} ${f.categoria}`.toLowerCase().includes(busca.toLowerCase())))
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [state.financeiro, tipo, statusFilter, edicaoFilter, busca]);

  const totalAberto = lista.filter((l) => !l.pagamento).reduce((acc, l) => acc + l.valor, 0);
  const totalPago = lista.filter((l) => !!l.pagamento).reduce((acc, l) => acc + l.valor, 0);

  const statusOptions: SelectOption[] = [
    { value: "todos", label: "Todos os status" },
    { value: "aberto", label: "Em aberto" },
    { value: "pago", label: tipo === "receita" ? "Recebidos" : "Pagos" },
  ];

  const edicaoOptions: SelectOption[] = [
    { value: "todas", label: "Todas as edições" },
    { value: "none", label: "Sem edição" },
    ...state.edicoes.map((e) => ({ value: e.slug, label: e.nome })),
  ];

  const cor = tipo === "receita" ? "emerald" : "rose";
  const titulo = tipo === "receita" ? "Contas a receber" : "Contas a pagar";
  const novoLabel = tipo === "receita" ? "Novo recebimento" : "Novo pagamento";

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold tracking-tight">{titulo}</div>
            <div className="text-[11px] text-muted-foreground">
              {formatNumberBR(lista.length)} lançamentos · em aberto{" "}
              <span className={cn("font-semibold", cor === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                {formatCurrencyBRL(totalAberto)}
              </span>{" "}
              · liquidados {formatCurrencyBRL(totalPago)}
            </div>
          </div>
          <Button onClick={() => setDialog({ open: true, mode: "create" })} className="gap-1.5">
            <Plus className="h-4 w-4" /> {novoLabel}
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por descrição ou categoria…" className="pl-8" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LancStatusFilter)} options={statusOptions} triggerClassName="min-w-[170px]" />
          <Select value={edicaoFilter} onValueChange={setEdicaoFilter} options={edicaoOptions} triggerClassName="min-w-[200px]" />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="bg-foreground/[0.02] dark:bg-white/[0.02]">
                <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Descrição</th>
                <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Categoria</th>
                <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Edição</th>
                <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Vencimento</th>
                <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Valor</th>
                <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-xs text-muted-foreground py-10">
                    Nenhum lançamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
              {lista.map((l) => {
                const edicao = l.edicaoSlug ? state.edicoes.find((e) => e.slug === l.edicaoSlug) : null;
                const pago = !!l.pagamento;
                const hoje = new Date().toISOString().slice(0, 10);
                const atrasado = !pago && l.vencimento < hoje;
                return (
                  <tr key={l.id} className="border-t border-border/50">
                    <td className="px-3 py-2.5">
                      {pago ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> {tipo === "receita" ? "Recebido" : "Pago"}
                        </Badge>
                      ) : atrasado ? (
                        <Badge variant="destructive" className="gap-1">
                          <CircleDot className="h-3 w-3" /> Atrasado
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="gap-1">
                          <CircleDot className="h-3 w-3" /> Em aberto
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 max-w-[280px]">
                      <div className="text-sm font-medium truncate">{l.descricao}</div>
                      {l.pagamento && (
                        <div className="text-[10px] text-muted-foreground">Liquidado em {formatDateBR(l.pagamento)}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{l.categoria}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {edicao ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarRange className="h-3 w-3" /> {edicao.nome}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/70">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs">{formatDateBR(l.vencimento)}</td>
                    <td className={cn("px-3 py-2.5 text-right font-semibold tabular-nums", cor === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/85")}>
                      {tipo === "receita" ? "+" : "−"}{formatCurrencyBRL(l.valor).replace("R$", "R$\u00a0")}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => togglePago(l.id, !pago)}
                          aria-label={pago ? "Reabrir" : "Liquidar"}
                          title={pago ? "Reabrir lançamento" : "Marcar como liquidado"}
                        >
                          <CheckCircle2 className={cn("h-3.5 w-3.5", pago ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDialog({ open: true, mode: "edit", id: l.id })} aria-label="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-rose-500 hover:bg-rose-500/10"
                          onClick={() => {
                            if (typeof window === "undefined") return;
                            if (window.confirm(`Excluir "${l.descricao}"?`)) removeLancamento(l.id);
                          }}
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {dialog.open && dialog.mode === "create" && (
        <LancamentoFormDialog
          open
          onOpenChange={(v) => !v && setDialog({ open: false })}
          mode={{ kind: "create", tipo }}
        />
      )}
      {dialog.open && dialog.mode === "edit" && (
        <LancamentoFormDialog
          open
          onOpenChange={(v) => !v && setDialog({ open: false })}
          mode={{ kind: "edit", id: dialog.id }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Margem por evento
// ---------------------------------------------------------------------------

function MargemTab({ margens }: { margens: MargemEdicao[] }) {
  if (margens.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        Cadastre uma edição em Produção de eventos para ver a margem por evento.
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {margens.map((m) => {
        const margemPct = m.receitaTotal > 0 ? Math.round(((m.receitaTotal - m.despesaTotal) / m.receitaTotal) * 100) : 0;
        const margemValor = m.receitaTotal - m.despesaTotal;
        return (
          <Card key={m.edicao.slug} className="p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-tight truncate">{m.edicao.nome}</div>
                <div className="text-[11px] text-muted-foreground truncate">{m.edicao.cidade}</div>
                <div className="text-[11px] text-muted-foreground/80">{m.edicao.data}</div>
              </div>
              <Badge variant={margemPct >= 30 ? "success" : margemPct >= 0 ? "warning" : "destructive"} className="tabular-nums">
                Margem {margemPct}%
              </Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat label="Receita ingressos" value={m.receitaIngressos} accent="emerald" />
              <Stat label="Patrocínios" value={m.edicao.patrocinio} accent="emerald" />
              <Stat label="Receitas vinculadas" value={m.receitasVinculadas} accent="emerald" hint="Recebimentos lançados na edição" />
              <Stat label="Despesas vinculadas" value={m.despesasVinculadas} accent="rose" hint="Pagamentos lançados na edição" />
              <Stat label="Custo de produção" value={m.edicao.custoProducao} accent="rose" />
              <Stat label="Resultado" value={margemValor} accent={margemValor >= 0 ? "emerald" : "rose"} />
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
  hint,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "rose";
  hint?: string;
}) {
  return (
    <div className="rounded-lg bg-foreground/[0.03] dark:bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-sm font-semibold tabular-nums",
          accent === "emerald" && "text-emerald-600 dark:text-emerald-400",
          accent === "rose" && "text-rose-600 dark:text-rose-400",
        )}
      >
        {formatCurrencyBRL(value)}
      </div>
      {hint && <div className="text-[10px] text-muted-foreground/80">{hint}</div>}
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
      else {
        aReceber += f.valor;
        aReceberCount += 1;
      }
    } else {
      if (f.pagamento) saidas += f.valor;
      else {
        aPagar += f.valor;
        aPagarCount += 1;
      }
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
  entradas: number;
  saidas: number;
  saldo: number;
  acumulado: number;
};

function computeFluxoMensal(financeiro: FinanceLancamento[]): FluxoMensal[] {
  const map = new Map<string, { entradas: number; saidas: number }>();
  for (const f of financeiro) {
    if (!f.pagamento) continue;
    const key = f.pagamento.slice(0, 7); // yyyy-mm
    const cur = map.get(key) ?? { entradas: 0, saidas: 0 };
    if (f.tipo === "receita") cur.entradas += f.valor;
    else cur.saidas += f.valor;
    map.set(key, cur);
  }
  const sortedKeys = Array.from(map.keys()).sort();
  let acumulado = 0;
  return sortedKeys.map((k) => {
    const { entradas, saidas } = map.get(k)!;
    const saldo = entradas - saidas;
    acumulado += saldo;
    const [ano, mes] = k.split("-");
    const label = `${MESES_PT[Number(mes) - 1] ?? mes}/${ano.slice(2)}`;
    return { mes: label, entradas, saidas, saldo, acumulado };
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
    const receitasVinculadas = vinculadas.filter((f) => f.tipo === "receita").reduce((a, f) => a + f.valor, 0);
    const despesasVinculadas = vinculadas.filter((f) => f.tipo === "despesa").reduce((a, f) => a + f.valor, 0);
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
