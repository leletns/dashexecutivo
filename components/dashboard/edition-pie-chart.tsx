"use client";

import * as React from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GlowWrapper } from "@/components/dashboard/glow-wrapper";
import { formatCurrencyBRL } from "@/lib/utils";
import { metricasEdicao, useAppState } from "@/lib/app-state";

const CORES = [
  "hsl(var(--brand-2))",
  "hsl(var(--brand-1))",
  "hsl(var(--brand-3))",
  "rgb(16,185,129)",
  "rgb(245,158,11)",
];

export function EditionPieChart() {
  const { state } = useAppState();

  const slices = React.useMemo(
    () =>
      state.edicoes.map((ed, i) => ({
        nome: ed.nome,
        valor: metricasEdicao(ed).receitaTotal,
        cor: CORES[i % CORES.length],
      })),
    [state.edicoes],
  );

  const total = slices.reduce((acc, s) => acc + s.valor, 0);

  return (
    <GlowWrapper className="rounded-2xl">
      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-semibold tracking-tight">
                Receita por edição
              </div>
              <div className="text-[11px] text-muted-foreground">
                Soma de ingressos + patrocínios cadastrados em cada edição
              </div>
            </div>
          </div>
          <Badge variant="brand" className="tabular-nums">
            {formatCurrencyBRL(total)}
          </Badge>
        </div>

        {slices.length === 0 ? (
          <div className="px-5 pb-8 pt-2 text-center text-sm text-muted-foreground">
            Cadastre edições em <span className="font-medium text-foreground">Produção de eventos</span> para
            ver a distribuição aqui.
          </div>
        ) : (
          <>
            <div className="px-2 pr-4">
              <div className="h-[230px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={slices}
                      dataKey="valor"
                      nameKey="nome"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={88}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                      paddingAngle={2}
                      isAnimationActive
                    >
                      {slices.map((s, i) => (
                        <Cell key={i} fill={s.cor} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="px-5 pb-5 space-y-1.5">
              {slices.map((s) => {
                const pct = total > 0 ? Math.round((s.valor / total) * 100) : 0;
                return (
                  <div key={s.nome} className="flex items-center gap-3 text-sm">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: s.cor }}
                    />
                    <span className="text-muted-foreground flex-1 truncate">{s.nome}</span>
                    <span className="tabular-nums font-medium">{formatCurrencyBRL(s.valor)}</span>
                    <span className="w-10 text-right text-[11px] text-muted-foreground tabular-nums">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </GlowWrapper>
  );
}

function PieTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl glass-strong px-3 py-2 text-xs shadow-xl">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.payload.cor }} />
        <span className="text-muted-foreground">{p.name}</span>
        <span className="font-medium tabular-nums">{formatCurrencyBRL(p.value)}</span>
      </div>
    </div>
  );
}
