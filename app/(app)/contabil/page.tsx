"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Calculator,
  Receipt,
  Users,
  Landmark,
  CheckCircle2,
  Download,
  CalendarClock,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ImpostosFolhaChart } from "@/components/dashboard/impostos-folha-chart";
import { useRegisterPageState } from "@/lib/page-state";
import { formatCurrencyBRL } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Select, type SelectOption } from "@/components/ui/select";
import { todayBrasilia } from "@/lib/timezone";
import {
  type Periodo,
  periodoParams,
  periodoQuery,
  periodoSufixo,
  mesSelectOptions,
} from "@/lib/periodo-financeiro";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type SituacaoCertidao = "regular" | "pendente";

type Certidao = {
  esfera: "Federal" | "Estadual" | "Municipal" | "Trabalhista" | "FGTS";
  orgao: string;
  numero: string;
  emissao: string;
  validade: string;
  situacao: SituacaoCertidao;
};

interface FluxoTotais {
  total_receitas_pagas: number;
  total_despesas_pagas: number;
  saldo_realizado: number;
  resultado_projetado: number;
  total_a_receber: number;
  total_a_pagar: number;
}

interface ClassificacaoRow {
  classificacao: string;
  total: number;
  count: number;
}

const CERTIDOES: Certidao[] = [];

// ─── Formatação compacta BRL ──────────────────────────────────────────────────

function fmtCompact(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(0)}k`;
  return formatCurrencyBRL(value);
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonKpi() {
  return (
    <Card className="p-4 animate-pulse">
      <div className="h-3 w-24 bg-foreground/[0.06] rounded mb-3" />
      <div className="h-7 w-28 bg-foreground/[0.06] rounded mb-2" />
      <div className="h-2 w-16 bg-foreground/[0.04] rounded" />
    </Card>
  );
}

// ─── KPI Card (somente leitura — dados reais) ─────────────────────────────────

function KpiReal({
  label,
  value,
  hint,
  accent = "neutral",
}: {
  label: string;
  value: number;
  hint?: string;
  accent?: "emerald" | "rose" | "neutral" | "amber" | "blue";
}) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    rose:    "text-rose-600 dark:text-rose-400",
    amber:   "text-amber-600 dark:text-amber-400",
    blue:    "text-blue-600 dark:text-blue-400",
    neutral: "text-foreground",
  };
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        {label}
      </p>
      <p className={cn("text-2xl font-semibold tabular-nums", colors[accent])}>
        {fmtCompact(value)}
      </p>
      {hint && (
        <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>
      )}
    </Card>
  );
}

// ─── Hook: dados reais do e-Gestor ────────────────────────────────────────────

function useDadosEGestor(periodo: Periodo) {
  const query = periodoQuery(periodo);
  const paramsStr = new URLSearchParams(periodoParams(periodo)).toString();
  const [totais, setTotais] = React.useState<FluxoTotais | null>(null);
  const [classificacoes, setClassificacoes] = React.useState<ClassificacaoRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [totalLanc, setTotalLanc] = React.useState(0);

  React.useEffect(() => {
    setLoading(true);

    // Busca totais do fluxo
    fetch(`/api/lancamentos/fluxo${query}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: any) => {
        if (d?.totais) setTotais(d.totais as FluxoTotais);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Busca total de lançamentos
    fetch(`/api/lancamentos?limit=1${paramsStr ? `&${paramsStr}` : ""}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: any) => { if (d?.total != null) setTotalLanc(Number(d.total)); })
      .catch(() => {});

    // Busca lançamentos para agrupamento por classificação (top despesas)
    fetch(`/api/lancamentos?rec_desp=Despesas&limit=200${paramsStr ? `&${paramsStr}` : ""}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: any) => {
        const rows: any[] = d?.data ?? [];
        const map = new Map<string, { total: number; count: number }>();
        for (const row of rows) {
          const k = row.classificacao || "Sem classificação";
          const cur = map.get(k) ?? { total: 0, count: 0 };
          cur.total += Number(row.valor) || 0;
          cur.count += 1;
          map.set(k, cur);
        }
        const sorted = Array.from(map.entries())
          .map(([classificacao, v]) => ({ classificacao, ...v }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 10);
        setClassificacoes(sorted);
      })
      .catch(() => {});
  }, [query, paramsStr]);

  return { totais, classificacoes, loading, totalLanc };
}

// ─── Página ───────────────────────────────────────────────────────────────────

const ANOS = ["", "2026", "2025", "2024", "2023", "2022"];

export default function ContabilPage() {
  const [periodo, setPeriodo] = React.useState<Periodo>(() => ({ ano: todayBrasilia().slice(0, 4), mes: -1 }));
  const { totais, classificacoes, loading, totalLanc } = useDadosEGestor(periodo);

  const regulares = CERTIDOES.filter((c) => c.situacao === "regular").length;

  useRegisterPageState({
    module: "Contábil",
    summary: [
      { label: "Receitas recebidas", value: totais ? fmtCompact(totais.total_receitas_pagas) : "—" },
      { label: "Despesas pagas",     value: totais ? fmtCompact(totais.total_despesas_pagas) : "—" },
      { label: "Saldo realizado",    value: totais ? fmtCompact(totais.saldo_realizado) : "—" },
      { label: "A pagar",            value: totais ? fmtCompact(totais.total_a_pagar) : "—" },
      { label: "Certidões regulares", value: `${regulares}/${CERTIDOES.length}` },
    ],
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-end justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Contábil</h1>
          <p className="text-xs text-muted-foreground">
            {totalLanc > 0
              ? `${totalLanc.toLocaleString("pt-BR")} movimentações${periodoSufixo(periodo)} · dados em tempo real do e-Gestor`
              : "Apurações, encargos e obrigações fiscais consolidadas"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro de período: ano + mês (com "Até o mês atual") */}
          <div className="flex gap-1 flex-wrap">
            {ANOS.map((a) => (
              <button
                key={a || "todos"}
                onClick={() => setPeriodo({ ano: a, mes: a ? periodo.mes : 0 })}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all",
                  periodo.ano === a
                    ? "bg-foreground text-background"
                    : "bg-foreground/[0.06] hover:bg-foreground/[0.11] text-muted-foreground"
                )}
              >
                {a || "Todos"}
              </button>
            ))}
          </div>
          {periodo.ano && (
            <Select
              value={String(periodo.mes)}
              onValueChange={(v) => setPeriodo({ ...periodo, mes: Number(v) })}
              options={mesSelectOptions() as SelectOption[]}
              triggerClassName="min-w-[130px] h-7 text-[12px]"
              align="end"
            />
          )}
          <Badge
            variant={CERTIDOES.length === 0 ? "outline" : "success"}
            className="gap-1.5 shrink-0"
          >
            <ShieldCheck className="h-3 w-3" />
            {CERTIDOES.length === 0
              ? "Nenhuma certidão"
              : `${regulares}/${CERTIDOES.length} regulares`}
          </Badge>
        </div>
      </motion.div>

      {/* KPIs reais do e-Gestor */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3"
      >
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonKpi key={i} />)
        ) : totais ? (
          <>
            <KpiReal
              label="Receitas recebidas"
              value={totais.total_receitas_pagas}
              hint="Pagamentos confirmados"
              accent="emerald"
            />
            <KpiReal
              label="Despesas pagas"
              value={totais.total_despesas_pagas}
              hint="Saídas confirmadas"
              accent="rose"
            />
            <KpiReal
              label="Saldo realizado"
              value={totais.saldo_realizado}
              hint="Receitas − despesas pagas"
              accent={totais.saldo_realizado >= 0 ? "emerald" : "rose"}
            />
            <KpiReal
              label="A receber"
              value={totais.total_a_receber}
              hint="Pendente de entrada"
              accent="amber"
            />
            <KpiReal
              label="A pagar"
              value={totais.total_a_pagar}
              hint="Pendente de saída"
              accent="blue"
            />
            <KpiReal
              label="Resultado projetado"
              value={totais.resultado_projetado}
              hint="Saldo + entradas − saídas previstas"
              accent={totais.resultado_projetado >= 0 ? "emerald" : "rose"}
            />
          </>
        ) : (
          <Card className="col-span-full p-4 text-center text-sm text-muted-foreground">
            Dados financeiros indisponíveis. Verifique a conexão com o Supabase.
          </Card>
        )}
      </motion.div>

      {/* Gráfico de impostos e folha */}
      <ImpostosFolhaChart />

      {/* Top despesas por classificação */}
      {classificacoes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          <Card className="overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold tracking-tight">
                  Top despesas por classificação
                  {periodoSufixo(periodo).replace(" — ", " · ")}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Do e-Gestor · {totalLanc > 0 ? `${totalLanc.toLocaleString("pt-BR")} lançamentos` : ""}
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Classificação</TableHead>
                  <TableHead className="text-right">Lançamentos</TableHead>
                  <TableHead className="text-right pr-5">Total (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classificacoes.map((c, i) => {
                  const maxVal = classificacoes[0]?.total ?? 1;
                  const pct = Math.round((c.total / maxVal) * 100);
                  return (
                    <TableRow key={c.classificacao}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm">{c.classificacao}</span>
                          <div className="h-1 rounded-full bg-foreground/[0.06] w-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-rose-500/60"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {c.count.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-rose-600 dark:text-rose-400 pr-5">
                        {formatCurrencyBRL(c.total)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </motion.div>
      )}

      {/* Certidões negativas */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.15 }}
      >
        <Card className="overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold tracking-tight">
                Certidões negativas
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              Preencha após integração com certidões online
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Esfera</TableHead>
                <TableHead>Órgão</TableHead>
                <TableHead>Nº da certidão</TableHead>
                <TableHead className="whitespace-nowrap">Emissão</TableHead>
                <TableHead className="whitespace-nowrap">Validade</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right pr-5">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CERTIDOES.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                    Nenhuma certidão listada. Importe ou conecte o serviço de consulta da contabilidade.
                  </TableCell>
                </TableRow>
              ) : (
                CERTIDOES.map((c) => (
                  <TableRow key={c.numero}>
                    <TableCell>
                      <Badge variant="outline">{c.esfera}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{c.orgao}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">{c.numero}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">{c.emissao}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">{c.validade}</TableCell>
                    <TableCell>
                      {c.situacao === "regular" ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Regular
                        </Badge>
                      ) : (
                        <Badge variant="warning">Renovar</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-5">
                      <Button size="sm" variant="ghost" className="h-7 px-2">
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </motion.div>
    </div>
  );
}
