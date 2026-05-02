"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyBRL } from "@/lib/utils";

const DATA = [
  { mes: "Jan", impostos: 64000, folha: 56000 },
  { mes: "Fev", impostos: 58000, folha: 56000 },
  { mes: "Mar", impostos: 71000, folha: 60000 },
  { mes: "Abr", impostos: 79000, folha: 62000 },
  { mes: "Mai", impostos: 74000, folha: 62000 },
  { mes: "Jun", impostos: 82000, folha: 64000 },
  { mes: "Jul", impostos: 90000, folha: 64000 },
  { mes: "Ago", impostos: 82300, folha: 64500 },
];

export function ImpostosFolhaChart() {
  const lastImpostos = DATA[DATA.length - 1].impostos;
  const lastFolha = DATA[DATA.length - 1].folha;

  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-sm font-semibold tracking-tight">
              Impostos vs folha
            </div>
            <div className="text-[11px] text-muted-foreground">
              Evolução mensal das duas maiores saídas operacionais
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="brand" className="tabular-nums">
            Impostos {formatCurrencyBRL(lastImpostos)}
          </Badge>
          <Badge variant="muted" className="tabular-nums">
            Folha {formatCurrencyBRL(lastFolha)}
          </Badge>
        </div>
      </div>
      <div className="pl-2 pr-4 pb-2">
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={DATA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-impostos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--brand-2))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--brand-2))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-folha" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.25} />
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
                width={48}
                tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<Tip />} cursor={{ stroke: "hsl(var(--border))" }} />
              <Area
                type="monotone"
                dataKey="impostos"
                stroke="hsl(var(--brand-2))"
                strokeWidth={2}
                fill="url(#grad-impostos)"
                isAnimationActive
              />
              <Area
                type="monotone"
                dataKey="folha"
                stroke="hsl(var(--foreground))"
                strokeWidth={1.6}
                strokeOpacity={0.55}
                fill="url(#grad-folha)"
                isAnimationActive
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl glass-strong px-3 py-2 text-xs shadow-xl">
      <div className="text-[11px] text-muted-foreground mb-1.5">{label}</div>
      <div className="space-y-1">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-6">
            <span className="capitalize text-muted-foreground">{p.dataKey}</span>
            <span className="font-medium tabular-nums">{formatCurrencyBRL(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
