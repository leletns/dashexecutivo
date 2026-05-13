"use client";

import * as React from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import type { BapsSnapshot } from "@/lib/baps/types";
import { formatNumberBR } from "@/lib/utils";

const META_EXCELENCIA = 70;

const DRIVER_PT: Record<string, string> = {
  Doctors:
    "Melhoria na curadoria de palestrantes, formato híbrido e percepção de valor clínico.",
  "Pré/Pós":
    "Credenciamento mais ágil, comunicação pré-evento e experiência de chegada/saída.",
  Gestores:
    "Patrocínios alinhados, networking dirigido e transparência nas entregas institucionais.",
};

export type NpsChartRow = {
  categoria: string;
  y2024: number;
  y2025: number;
  meta: number;
  driver: string;
};

function buildChartRows(data: BapsSnapshot): NpsChartRow[] {
  const cats = ["Doctors", "Pré/Pós", "Gestores"];
  return cats.map((categoria) => {
    const y2024 = data.nps_metricas.find((n) => n.categoria === categoria && n.ano === 2024)?.valor ?? 0;
    const y2025 = data.nps_metricas.find((n) => n.categoria === categoria && n.ano === 2025)?.valor ?? 0;
    return {
      categoria,
      y2024,
      y2025,
      meta: META_EXCELENCIA,
      driver: DRIVER_PT[categoria] ?? "",
    };
  });
}

function PerfectTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: NpsChartRow }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const delta = row.y2025 - row.y2024;
  return (
    <div className="rounded-xl border border-border/70 bg-popover/95 backdrop-blur-md px-3 py-2.5 shadow-lg max-w-[280px] text-xs">
      <p className="font-semibold text-foreground mb-1">{row.categoria}</p>
      <div className="space-y-1 text-muted-foreground tabular-nums">
        <div className="flex justify-between gap-4">
          <span>2024</span>
          <span className="text-foreground font-medium">{formatNumberBR(row.y2024)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>2025</span>
          <span className="text-foreground font-medium">{formatNumberBR(row.y2025)}</span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-border/50">
          <span>Δ</span>
          <span className={delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}>
            {delta >= 0 ? "+" : ""}
            {formatNumberBR(delta)}
          </span>
        </div>
      </div>
      <p className="mt-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground leading-relaxed">
        <span className="font-medium text-foreground">Por quê: </span>
        {row.driver}
      </p>
    </div>
  );
}

export function NpsComposedChart({ data }: { data: BapsSnapshot }) {
  const rows = React.useMemo(() => buildChartRows(data), [data]);

  return (
    <Card className="p-5 sm:p-6 rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm shadow-sm print:break-inside-avoid overflow-hidden">
      <header className="mb-4">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Qualidade · NPS composto (2024 vs 2025)
        </h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-2xl">
          Barras agrupadas por público com linha de meta de excelência fixada em {META_EXCELENCIA}. Passe o cursor para ver o
          contexto qualitativo de cada avanço.
        </p>
      </header>
      <div className="h-[320px] w-full baps-chart-print baps-chart-print-composed">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 12, right: 12, left: -8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/45" />
            <XAxis
              dataKey="categoria"
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, "auto"]}
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip content={<PerfectTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.12)" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="y2024" name="2024" fill="#A5B4FC" radius={[4, 4, 0, 0]} barSize={26} />
            <Bar dataKey="y2025" name="2025" fill="#7C3AED" radius={[4, 4, 0, 0]} barSize={26} />
            <Line
              type="monotone"
              dataKey="meta"
              name={`Meta (${META_EXCELENCIA})`}
              stroke="#F59E0B"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              activeDot={{ r: 4, fill: "#F59E0B" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
