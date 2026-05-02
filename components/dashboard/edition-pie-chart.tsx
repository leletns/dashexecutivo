"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { PieChart as PieIcon, Pencil, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GlowWrapper } from "@/components/dashboard/glow-wrapper";
import { formatCurrencyBRL, parseLooseNumber } from "@/lib/utils";

type Slice = { nome: string; valor: number; cor: string };

const SEED: Slice[] = [
  { nome: "1ª edição", valor: 720000, cor: "hsl(var(--brand-2))" },
  { nome: "2ª edição", valor: 980000, cor: "hsl(var(--brand-1))" },
  { nome: "3ª edição", valor: 540000, cor: "hsl(var(--brand-3))" },
  { nome: "4ª edição", valor: 290000, cor: "rgb(16,185,129)" },
];

export function EditionPieChart() {
  const [slices, setSlices] = React.useState<Slice[]>(SEED);
  const [editing, setEditing] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState("");
  const total = slices.reduce((acc, s) => acc + s.valor, 0);

  const begin = (i: number) => {
    setEditing(i);
    setDraft(String(slices[i].valor).replace(".", ","));
  };
  const commit = () => {
    if (editing === null) return;
    const v = parseLooseNumber(draft);
    setSlices((p) => p.map((s, i) => (i === editing ? { ...s, valor: v } : s)));
    setEditing(null);
  };

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
                Distribuição entre as quatro edições anuais
              </div>
            </div>
          </div>
          <Badge variant="brand" className="tabular-nums">
            {formatCurrencyBRL(total)}
          </Badge>
        </div>

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
          {slices.map((s, i) => {
            const pct = total > 0 ? Math.round((s.valor / total) * 100) : 0;
            return (
              <div key={s.nome} className="flex items-center gap-3 text-sm">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: s.cor }}
                />
                <span className="text-muted-foreground flex-1 truncate">{s.nome}</span>
                {editing === i ? (
                  <div className="flex items-center gap-1">
                    <Input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={commit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commit();
                        if (e.key === "Escape") setEditing(null);
                      }}
                      inputMode="decimal"
                      className="h-7 w-32 px-2 text-right text-sm tabular-nums"
                    />
                    <button
                      onClick={commit}
                      className="h-7 w-7 grid place-items-center rounded-lg bg-foreground text-background"
                      aria-label="Salvar"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => begin(i)}
                    className="group/value inline-flex items-center gap-1.5 tabular-nums font-medium hover:opacity-80"
                  >
                    <motion.span key={s.valor} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                      {formatCurrencyBRL(s.valor)}
                    </motion.span>
                    <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/value:opacity-100" />
                  </button>
                )}
                <span className="w-10 text-right text-[11px] text-muted-foreground tabular-nums">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
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
