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
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, type SelectOption } from "@/components/ui/select";
import { KpiInline } from "@/components/dashboard/kpi-inline";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/utils";

type Lote = {
  nome: string;
  preco: number;
  vendidos: number;
  estoque: number;
  cor: string;
};

type Edicao = {
  slug: string;
  nome: string;
  cidade: string;
  data: string;
  capacidade: number;
  patrocinio: number;
  lotes: Lote[];
};

const EDICOES: Edicao[] = [
  {
    slug: "edicao-1",
    nome: "1ª edição anual",
    cidade: "São Paulo · Centro de convenções Aurora",
    data: "12 a 16 de março de 2026",
    capacidade: 2500,
    patrocinio: 480000,
    lotes: [
      { nome: "Pista", preco: 290, vendidos: 1180, estoque: 420, cor: "hsl(var(--brand-3))" },
      { nome: "Premium", preco: 490, vendidos: 540, estoque: 180, cor: "hsl(var(--brand-1))" },
      { nome: "VIP", preco: 980, vendidos: 210, estoque: 90, cor: "hsl(var(--brand-2))" },
      { nome: "Camarote executivo", preco: 1800, vendidos: 60, estoque: 30, cor: "rgb(16,185,129)" },
    ],
  },
  {
    slug: "edicao-2",
    nome: "2ª edição anual",
    cidade: "Rio de Janeiro · Marina da Glória",
    data: "18 a 22 de junho de 2026",
    capacidade: 3200,
    patrocinio: 640000,
    lotes: [
      { nome: "Pista", preco: 320, vendidos: 1340, estoque: 660, cor: "hsl(var(--brand-3))" },
      { nome: "Premium", preco: 540, vendidos: 480, estoque: 320, cor: "hsl(var(--brand-1))" },
      { nome: "VIP", preco: 1080, vendidos: 240, estoque: 110, cor: "hsl(var(--brand-2))" },
      { nome: "Camarote executivo", preco: 2100, vendidos: 40, estoque: 50, cor: "rgb(16,185,129)" },
    ],
  },
  {
    slug: "edicao-3",
    nome: "3ª edição anual",
    cidade: "Belo Horizonte · Expominas",
    data: "10 a 14 de setembro de 2026",
    capacidade: 2800,
    patrocinio: 520000,
    lotes: [
      { nome: "Pista", preco: 280, vendidos: 720, estoque: 1080, cor: "hsl(var(--brand-3))" },
      { nome: "Premium", preco: 460, vendidos: 220, estoque: 480, cor: "hsl(var(--brand-1))" },
      { nome: "VIP", preco: 940, vendidos: 80, estoque: 180, cor: "hsl(var(--brand-2))" },
      { nome: "Camarote executivo", preco: 1700, vendidos: 12, estoque: 38, cor: "rgb(16,185,129)" },
    ],
  },
  {
    slug: "edicao-4",
    nome: "4ª edição anual",
    cidade: "Brasília · Centro de eventos Brasil 21",
    data: "26 a 29 de novembro de 2026",
    capacidade: 2200,
    patrocinio: 460000,
    lotes: [
      { nome: "Pista", preco: 310, vendidos: 320, estoque: 1080, cor: "hsl(var(--brand-3))" },
      { nome: "Premium", preco: 520, vendidos: 90, estoque: 410, cor: "hsl(var(--brand-1))" },
      { nome: "VIP", preco: 1020, vendidos: 30, estoque: 160, cor: "hsl(var(--brand-2))" },
      { nome: "Camarote executivo", preco: 1900, vendidos: 4, estoque: 36, cor: "rgb(16,185,129)" },
    ],
  },
];

const OPTIONS: SelectOption[] = EDICOES.map((e) => ({
  value: e.slug,
  label: e.nome,
  hint: e.data,
}));

export default function EventosPage() {
  const [slug, setSlug] = React.useState(EDICOES[0].slug);
  const [edicoes, setEdicoes] = React.useState<Edicao[]>(EDICOES);
  const ed = edicoes.find((e) => e.slug === slug)!;

  const totalVendidos = ed.lotes.reduce((acc, l) => acc + l.vendidos, 0);
  const ocupacao = Math.round((totalVendidos / ed.capacidade) * 100);
  const receitaIngressos = ed.lotes.reduce((acc, l) => acc + l.preco * l.vendidos, 0);

  const updateLote = (loteIdx: number, key: "vendidos" | "estoque" | "preco", value: number) => {
    setEdicoes((prev) =>
      prev.map((e) =>
        e.slug !== slug
          ? e
          : {
              ...e,
              lotes: e.lotes.map((l, i) => (i === loteIdx ? { ...l, [key]: value } : l)),
            },
      ),
    );
  };

  const updatePatrocinio = (v: number) => {
    setEdicoes((prev) => prev.map((e) => (e.slug !== slug ? e : { ...e, patrocinio: v })));
  };

  const pieData = [
    ...ed.lotes.map((l) => ({ name: l.nome, value: l.vendidos, color: l.cor })),
    {
      name: "Disponível",
      value: Math.max(ed.capacidade - totalVendidos, 0),
      color: "hsl(var(--muted))",
    },
  ];

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-end justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Produção de eventos
          </h1>
          <p className="text-xs text-muted-foreground">
            Acompanhamento operacional e comercial das quatro edições anuais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={slug}
            onValueChange={setSlug}
            options={OPTIONS}
            triggerClassName="min-w-[240px]"
          />
        </div>
      </motion.div>

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
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl bg-[hsl(var(--brand-1)/0.15)] grid place-items-center text-[hsl(var(--brand-2))] dark:text-[hsl(var(--brand-3))]">
                  <CalendarRange className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-semibold tracking-tight">{ed.nome}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <MapPin className="h-3 w-3" />
                    {ed.cidade}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{ed.data}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="brand" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  Ocupação {ocupacao}%
                </Badge>
                <Badge variant="muted">Capacidade {formatNumberBR(ed.capacidade)}</Badge>
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
                label="Público confirmado"
                value={totalVendidos}
                onChange={() => {}}
                icon={Users}
                format="number"
                hint="Soma dos lotes"
              />
              <KpiInline
                label="Taxa de ocupação"
                value={ocupacao}
                onChange={() => {}}
                icon={Sparkles}
                format="percent"
                hint="Vendidos / capacidade"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ed.lotes.map((lote, i) => {
              const total = lote.vendidos + lote.estoque;
              const pct = total > 0 ? Math.round((lote.vendidos / total) * 100) : 0;
              return (
                <Card key={lote.nome} className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[12px] font-medium text-muted-foreground tracking-tight">
                        Lote {lote.nome}
                      </div>
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
                      onChange={(v) => updateLote(i, "preco", v)}
                      format="currency"
                    />
                    <InlineField
                      label="Vendidos"
                      value={lote.vendidos}
                      onChange={(v) => updateLote(i, "vendidos", v)}
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
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      Estoque restante:{" "}
                      <button
                        onClick={() => {
                          const v = prompt(`Estoque atual de ${lote.nome}`, String(lote.estoque));
                          if (v !== null) updateLote(i, "estoque", Math.max(Number(v) || 0, 0));
                        }}
                        className="text-foreground font-medium tabular-nums underline-offset-2 hover:underline"
                      >
                        {formatNumberBR(lote.estoque)}
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
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
