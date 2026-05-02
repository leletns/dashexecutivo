"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Pencil, Check, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GlowWrapper } from "@/components/dashboard/glow-wrapper";
import { formatCurrencyBRL, parseLooseNumber } from "@/lib/utils";

type Row = {
  categoria: string;
  receita: number;
  custo: number;
  cor: string;
};

const SEED: Row[] = [
  { categoria: "Patrocínios", receita: 980000, custo: 120000, cor: "hsl(var(--brand-2))" },
  { categoria: "Ingressos", receita: 720000, custo: 240000, cor: "hsl(var(--brand-1))" },
  { categoria: "Ativações de marca", receita: 360000, custo: 95000, cor: "hsl(var(--brand-3))" },
  { categoria: "Catering & bar", receita: 240000, custo: 180000, cor: "rgb(16,185,129)" },
  { categoria: "Pacotes corporativos", receita: 410000, custo: 90000, cor: "rgb(245,158,11)" },
];

export function CategoryBarChart() {
  const [rows, setRows] = React.useState<Row[]>(SEED);
  const [editing, setEditing] = React.useState<{ idx: number; field: "receita" | "custo" } | null>(
    null,
  );
  const [draft, setDraft] = React.useState("");

  const totalReceita = rows.reduce((acc, r) => acc + r.receita, 0);
  const totalCusto = rows.reduce((acc, r) => acc + r.custo, 0);

  const beginEdit = (idx: number, field: "receita" | "custo") => {
    setEditing({ idx, field });
    setDraft(String(rows[idx][field]).replace(".", ","));
  };
  const commit = () => {
    if (!editing) return;
    const v = parseLooseNumber(draft);
    setRows((p) =>
      p.map((r, i) => (i === editing.idx ? { ...r, [editing.field]: v } : r)),
    );
    setEditing(null);
  };

  return (
    <GlowWrapper className="rounded-2xl">
      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-semibold tracking-tight">
                Receita vs custo por categoria
              </div>
              <div className="text-[11px] text-muted-foreground">
                Toque nos valores da tabela para editar
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <Badge variant="brand">{formatCurrencyBRL(totalReceita)} receita</Badge>
            <Badge variant="muted">{formatCurrencyBRL(totalCusto)} custo</Badge>
          </div>
        </div>

        <div className="px-2 pr-4">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="bar-receita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--brand-2))" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="hsl(var(--brand-1))" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="bar-custo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0.12} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  className="stroke-border/50"
                />
                <XAxis
                  dataKey="categoria"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<BarTip />} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
                <Bar
                  dataKey="receita"
                  fill="url(#bar-receita)"
                  radius={[8, 8, 4, 4]}
                  isAnimationActive
                />
                <Bar
                  dataKey="custo"
                  fill="url(#bar-custo)"
                  radius={[8, 8, 4, 4]}
                  isAnimationActive
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-foreground/[0.02] dark:bg-white/[0.02]">
                  <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    Categoria
                  </th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    Receita
                  </th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    Custo
                  </th>
                  <th className="text-right px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    Margem
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const margem = r.receita > 0 ? Math.round(((r.receita - r.custo) / r.receita) * 100) : 0;
                  return (
                    <tr key={r.categoria} className="border-t border-border/50">
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: r.cor }}
                          />
                          {r.categoria}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <EditCell
                          editing={editing?.idx === i && editing.field === "receita"}
                          value={r.receita}
                          draft={draft}
                          setDraft={setDraft}
                          commit={commit}
                          cancel={() => setEditing(null)}
                          begin={() => beginEdit(i, "receita")}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <EditCell
                          editing={editing?.idx === i && editing.field === "custo"}
                          value={r.custo}
                          draft={draft}
                          setDraft={setDraft}
                          commit={commit}
                          cancel={() => setEditing(null)}
                          begin={() => beginEdit(i, "custo")}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Badge
                          variant={margem >= 50 ? "success" : margem >= 25 ? "warning" : "destructive"}
                          className="tabular-nums"
                        >
                          {margem}%
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </GlowWrapper>
  );
}

function EditCell({
  editing,
  value,
  draft,
  setDraft,
  commit,
  cancel,
  begin,
}: {
  editing: boolean;
  value: number;
  draft: string;
  setDraft: (v: string) => void;
  commit: () => void;
  cancel: () => void;
  begin: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          inputMode="decimal"
          className="h-7 text-sm tabular-nums px-2 w-32 text-right"
        />
        <button
          onClick={commit}
          className="h-7 w-7 grid place-items-center rounded-lg bg-foreground text-background"
          aria-label="Salvar"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={begin}
      className="group/cell inline-flex items-center gap-1 tabular-nums text-sm font-medium hover:opacity-80"
    >
      <motion.span key={value} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
        {formatCurrencyBRL(value)}
      </motion.span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/cell:opacity-100" />
    </button>
  );
}

function BarTip({ active, payload, label }: any) {
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
