"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDashboardContext } from "@/components/dashboard/dashboard-context";
import { GlowWrapper } from "@/components/dashboard/glow-wrapper";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCurrencyBRL } from "@/lib/utils";

export function RevenueChart() {
  const { series } = useDashboardContext();

  return (
    <GlowWrapper className="rounded-2xl">
      <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <div className="text-sm font-semibold tracking-tight text-foreground">
            Desempenho consolidado
          </div>
          <div className="text-[11px] text-muted-foreground">
            Receita, despesa e lucro por mês
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <Legend dot="bg-foreground" label="Receita" />
          <Legend dot="bg-foreground/40" label="Despesa" />
          <Legend dot="bg-emerald-500" label="Lucro" />
        </div>
      </CardHeader>
      <CardContent className="pl-2 pr-4">
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-receita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-despesa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-lucro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(16,185,129)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="rgb(16,185,129)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
              <XAxis
                dataKey="month"
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
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "hsl(var(--border))" }} />
              <Area
                type="monotone"
                dataKey="receita"
                stroke="hsl(var(--foreground))"
                strokeWidth={2}
                fill="url(#grad-receita)"
                isAnimationActive
                animationDuration={500}
              />
              <Area
                type="monotone"
                dataKey="despesa"
                stroke="hsl(var(--foreground))"
                strokeOpacity={0.45}
                strokeWidth={1.5}
                fill="url(#grad-despesa)"
                isAnimationActive
                animationDuration={500}
              />
              <Area
                type="monotone"
                dataKey="lucro"
                stroke="rgb(16,185,129)"
                strokeWidth={2}
                fill="url(#grad-lucro)"
                isAnimationActive
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
      </Card>
    </GlowWrapper>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function ChartTooltip({ active, payload, label }: any) {
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
