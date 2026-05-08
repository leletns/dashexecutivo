"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import type { BapsAssociadosResumoRow } from "@/lib/baps/types";
import { formatNumberBR } from "@/lib/utils";

const CHURN_PALETTE = ["#c084fc", "#818cf8", "#38bdf8"] as const;

type Props = { associados: BapsAssociadosResumoRow };

export function CommercialOverview({ associados }: Props) {
  const churnBars = [
    { periodo: "Semana", valor: associados.saidas_semana, fill: CHURN_PALETTE[0] },
    { periodo: "Mês", valor: associados.saidas_mes, fill: CHURN_PALETTE[1] },
    { periodo: "Ano (YTD)", valor: associados.saidas_ytd, fill: CHURN_PALETTE[2] },
  ];

  const macroCompare = [
    { nome: "Ativos", valor: associados.total_ativos, fill: "#22c55e" },
    { nome: "Venc. no mês", valor: associados.vencimentos_mes, fill: "#0ea5e9" },
  ];

  return (
    <Card className="p-5 sm:p-6 rounded-2xl border-border/60 shadow-sm print:break-inside-avoid overflow-hidden">
      <header className="border-b border-border/50 pb-4 mb-5">
        <h2 className="text-sm font-semibold tracking-tight">
          Associados · marketing · comercial
        </h2>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-3xl">
          Base de associados, renovações, saídas (churn) e patrocínios — leitura única para marketing e time comercial.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Indicadores principais
          </p>
          <div className="grid grid-cols-2 gap-3">
            <MetricTile
              title="Associados ativos"
              value={formatNumberBR(associados.total_ativos)}
              caption="Total na base vigente"
            />
            <MetricTile
              title="Renovações no mês"
              value={formatNumberBR(associados.vencimentos_mes)}
              caption="Associados com vencimento neste mês"
            />
          </div>
          <div className="h-[200px] w-full mt-2">
            <p className="text-[11px] text-muted-foreground mb-2">Ativos × renovações no mês</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={macroCompare} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.12)" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border) / 0.6)",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [formatNumberBR(Number(v)), ""]}
                />
                <Bar dataKey="valor" radius={[8, 8, 4, 4]} maxBarSize={56}>
                  {macroCompare.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Saídas (churn)
          </p>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={churnBars}
                margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border/40" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="periodo"
                  width={72}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.12)" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border) / 0.6)",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [formatNumberBR(Number(v)), "Saídas"]}
                />
                <Bar dataKey="valor" radius={[0, 8, 8, 0]} barSize={22}>
                  {churnBars.map((_, i) => (
                    <Cell key={i} fill={CHURN_PALETTE[i % CHURN_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <aside className="rounded-xl border border-border/60 bg-foreground/[0.02] dark:bg-white/[0.03] px-4 py-3 text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Patrocínios e parcerias — </span>
            {associados.notas_comercial}
          </aside>
        </div>
      </div>
    </Card>
  );
}

function MetricTile({
  title,
  value,
  caption,
}: {
  title: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-foreground/[0.02] dark:bg-white/[0.03] px-4 py-3">
      <div className="text-[11px] text-muted-foreground leading-snug">{title}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</div>
      <div className="mt-1 text-[10px] text-muted-foreground/90 leading-snug">{caption}</div>
    </div>
  );
}
