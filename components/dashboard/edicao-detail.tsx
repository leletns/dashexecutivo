"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  CalendarRange,
  MapPin,
  Ticket,
  Users,
  Sparkles,
  TrendingUp,
  Pencil,
  Plus,
  Trash2,
  Copy,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiInline } from "@/components/dashboard/kpi-inline";
import { EdicaoFormDialog } from "@/components/dashboard/edicao-form-dialog";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/utils";
import {
  type Edicao,
  metricasEdicao,
  useAppState,
} from "@/lib/app-state";

export function EdicaoDetail({
  slug,
  showDelete = true,
}: {
  slug: string;
  showDelete?: boolean;
}) {
  const {
    state,
    patchEdicao,
    patchLote,
    addLote,
    removeLote,
    removeEdicao,
    duplicateEdicao,
  } = useAppState();
  const [editOpen, setEditOpen] = React.useState(false);
  const ed = state.edicoes.find((e) => e.slug === slug);

  if (!ed) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        Edição não encontrada. Talvez tenha sido removida do painel.
      </Card>
    );
  }

  const { totalVendidos, ocupacao, receitaIngressos, receitaTotal, margemValor, margemPct } =
    metricasEdicao(ed);

  const updatePatrocinio = (v: number) => patchEdicao(ed.slug, { patrocinio: v });
  const updateCusto = (v: number) => patchEdicao(ed.slug, { custoProducao: v });

  const pieData = [
    ...ed.lotes.map((l) => ({ name: l.nome, value: l.vendidos, color: l.cor })),
    {
      name: "Disponível",
      value: Math.max(ed.capacidade - totalVendidos, 0),
      color: "hsl(var(--muted))",
    },
  ];

  const askDelete = () => {
    const ok = typeof window !== "undefined"
      ? window.confirm(`Excluir definitivamente "${ed.nome}"? Lançamentos financeiros vinculados serão desassociados.`)
      : false;
    if (ok) removeEdicao(ed.slug);
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={ed.slug}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
        className="space-y-5"
      >
        <Card className="p-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-11 w-11 rounded-xl bg-[hsl(var(--brand-1)/0.15)] grid place-items-center text-[hsl(var(--brand-2))] dark:text-[hsl(var(--brand-3))] shrink-0">
                <CalendarRange className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-semibold tracking-tight truncate">{ed.nome}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{ed.cidade}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{ed.data}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Badge variant="brand" className="gap-1">
                <Sparkles className="h-3 w-3" />
                Ocupação {ocupacao}%
              </Badge>
              <Badge variant="muted">Capacidade {formatNumberBR(ed.capacidade)}</Badge>
              <Badge variant={margemPct >= 30 ? "success" : margemPct >= 0 ? "warning" : "destructive"}>
                Margem {margemPct}%
              </Badge>
              <Button size="sm" variant="glass" className="gap-1.5" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                onClick={() => duplicateEdicao(ed.slug)}
                title="Duplicar edição"
              >
                <Copy className="h-3.5 w-3.5" /> Duplicar
              </Button>
              {showDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-rose-600 hover:bg-rose-500/10"
                  onClick={askDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </Button>
              )}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className="p-5 lg:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold tracking-tight">
                Ocupação por categoria
              </div>
              <Badge variant="muted" className="tabular-nums">
                {formatNumberBR(totalVendidos)} / {formatNumberBR(ed.capacidade)}
              </Badge>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={64}
                    outerRadius={96}
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                    paddingAngle={2}
                  >
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-[11px]">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-muted-foreground truncate">{d.name}</span>
                  <span className="ml-auto tabular-nums">{formatNumberBR(d.value)}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <KpiInline
              label="Receita de ingressos"
              value={receitaIngressos}
              onChange={() => {}}
              icon={Ticket}
              format="currency"
              hint="Calculada a partir dos lotes"
            />
            <KpiInline
              label="Patrocínios contratados"
              value={ed.patrocinio}
              onChange={updatePatrocinio}
              icon={TrendingUp}
              format="currency"
              hint="Edite para simular cenário"
            />
            <KpiInline
              label="Custo de produção"
              value={ed.custoProducao}
              onChange={updateCusto}
              icon={Users}
              format="currency"
              hint="Total de gastos diretos da edição"
            />
            <KpiInline
              label="Margem do evento"
              value={margemValor}
              onChange={() => {}}
              icon={Sparkles}
              format="currency"
              hint={`Receita total ${formatCurrencyBRL(receitaTotal)} · ${margemPct}%`}
            />
          </div>
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <div className="text-sm font-semibold tracking-tight">Lotes da edição</div>
              <div className="text-[11px] text-muted-foreground">
                Toque nos números para editar preço, vendidos e estoque
              </div>
            </div>
            <Button size="sm" variant="glass" className="gap-1.5" onClick={() => addLote(ed.slug)}>
              <Plus className="h-3.5 w-3.5" /> Novo lote
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ed.lotes.map((lote, i) => {
              const total = lote.vendidos + lote.estoque;
              const pct = total > 0 ? Math.round((lote.vendidos / total) * 100) : 0;
              return (
                <Card key={`${ed.slug}-${i}`} className="p-5 relative group/lote">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <button
                        onClick={() => {
                          if (typeof window === "undefined") return;
                          const v = window.prompt("Nome do lote", lote.nome);
                          if (v && v.trim()) patchLote(ed.slug, i, { nome: v.trim() });
                        }}
                        className="text-[12px] font-medium text-muted-foreground tracking-tight hover:text-foreground transition-colors"
                      >
                        Lote {lote.nome}
                      </button>
                      <div className="text-[11px] text-muted-foreground/70">
                        Preço por ingresso
                      </div>
                    </div>
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: lote.cor }}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <InlineField
                      label="Preço"
                      value={lote.preco}
                      onChange={(v) => patchLote(ed.slug, i, { preco: v })}
                      format="currency"
                    />
                    <InlineField
                      label="Vendidos"
                      value={lote.vendidos}
                      onChange={(v) => patchLote(ed.slug, i, { vendidos: v })}
                      format="number"
                    />
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Vendidos vs estoque</span>
                      <span className="tabular-nums">{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-foreground/[0.06] dark:bg-white/[0.06] overflow-hidden">
                      <motion.div
                        initial={false}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: lote.cor }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="text-[11px] text-muted-foreground">
                        Estoque restante:{" "}
                        <button
                          onClick={() => {
                            if (typeof window === "undefined") return;
                            const v = window.prompt(
                              `Estoque atual de ${lote.nome}`,
                              String(lote.estoque),
                            );
                            if (v !== null) patchLote(ed.slug, i, { estoque: Math.max(Number(v) || 0, 0) });
                          }}
                          className="text-foreground font-medium tabular-nums underline-offset-2 hover:underline"
                        >
                          {formatNumberBR(lote.estoque)}
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          if (typeof window === "undefined") return;
                          if (window.confirm(`Remover o lote "${lote.nome}"?`)) {
                            removeLote(ed.slug, i);
                          }
                        }}
                        className="opacity-0 group-hover/lote:opacity-100 transition-opacity text-rose-500 hover:text-rose-600"
                        aria-label="Remover lote"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </Card>

        <EdicaoFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          mode={{ kind: "edit", slug: ed.slug }}
        />
      </motion.div>
    </AnimatePresence>
  );
}

function InlineField({
  label,
  value,
  onChange,
  format,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  format: "currency" | "number";
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  const display =
    format === "currency" ? formatCurrencyBRL(value) : formatNumberBR(value);

  const begin = () => {
    setDraft(String(value).replace(".", ","));
    setEditing(true);
  };
  const commit = () => {
    const n = Number(draft.replace(/\./g, "").replace(",", "."));
    onChange(Number.isFinite(n) ? n : value);
    setEditing(false);
  };

  return (
    <div className="rounded-lg bg-foreground/[0.03] dark:bg-white/[0.03] px-2.5 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          inputMode="decimal"
          className="w-full bg-transparent text-sm font-semibold tabular-nums outline-none"
        />
      ) : (
        <button
          onClick={begin}
          className="text-sm font-semibold tabular-nums leading-tight hover:opacity-80"
        >
          {display}
        </button>
      )}
    </div>
  );
}

function PieTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl glass-strong px-3 py-2 text-xs shadow-xl">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: p.payload.color }}
        />
        <span className="text-muted-foreground">{p.name}</span>
        <span className="font-medium tabular-nums">{formatNumberBR(p.value)}</span>
      </div>
    </div>
  );
}
