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
import { Pencil, Check, BarChart3, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlowWrapper } from "@/components/dashboard/glow-wrapper";
import { formatCurrencyBRL, parseLooseNumber } from "@/lib/utils";

type Row = {
  categoria: string;
  receita: number;
  custo: number;
  cor: string;
};

const CORES = [
  "hsl(var(--brand-2))",
  "hsl(var(--brand-1))",
  "hsl(var(--brand-3))",
  "rgb(16,185,129)",
  "rgb(245,158,11)",
];

const CAT_KEY = "portal.category-chart.v1";

function loadRows(): Row[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CAT_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as Row[];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function saveRows(rows: Row[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CAT_KEY, JSON.stringify(rows));
  } catch {
    // ignore
  }
}

export function CategoryBarChart() {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [editing, setEditing] = React.useState<{ idx: number; field: "receita" | "custo" } | null>(
    null,
  );
  const [draft, setDraft] = React.useState("");

  React.useEffect(() => {
    setRows(loadRows());
  }, []);

  React.useEffect(() => {
    saveRows(rows);
  }, [rows]);

  const totalReceita = rows.reduce((acc, r) => acc + r.receita, 0);
  const totalCusto = rows.reduce((acc, r) => acc + r.custo, 0);

  const addCategoria = () => {
    if (typeof window === "undefined") return;
    const nome = window.prompt("Nome da categoria (ex.: Patrocínios, Ingressos)");
    if (!nome?.trim()) return;
    setRows((p) => [
      ...p,
      {
        categoria: nome.trim(),
        receita: 0,
        custo: 0,
        cor: CORES[p.length % CORES.length],
      },
    ]);
  };

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
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={addCategoria}>
              <Plus className="h-3.5 w-3.5" /> Categoria
            </Button>
          </div>
        </div>

        <div className="px-2 pr-4 sm:hidden pb-2">
          <Button type="button" size="sm" variant="outline" className="w-full gap-1" onClick={addCategoria}>
            <Plus className="h-3.5 w-3.5" /> Adicionar categoria
          </Button>
        </div>

        <div className="px-2 pr-4">
          <div className="h-[260px]">
            {rows.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-3 rounded-xl border border-dashed border-border/70 bg-foreground/[0.02] dark:bg-white/[0.02]">
                <p className="text-sm text-muted-foreground max-w-sm">
                  Nenhuma categoria cadastrada. Use o botão <span className="font-medium text-foreground">Categoria</span> para
                  criar linhas (ex.: patrocínios, ingressos). Os valores ficam salvos neste navegador até integrar com seu ERP.
                </p>
                <Button type="button" size="sm" className="gap-1.5" onClick={addCategoria}>
                  <Plus className="h-4 w-4" /> Primeira categoria
                </Button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  className="stroke-border/50"
                />
                <XAxis
                  dataKey="categoria"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tickFormatter={(v) =>
                    String(v).length > 14 ? `${String(v).slice(0, 12)}…` : String(v)
                  }
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
                  fill="#7C3AED"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive
                />
                <Bar
                  dataKey="custo"
                  fill="#E5383B"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive
                />
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="px-3 sm:px-5 pb-5">
          <div className="rounded-xl border border-border/60 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
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
