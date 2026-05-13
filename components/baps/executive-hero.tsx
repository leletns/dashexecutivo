"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Landmark, Scale, TrendingUp, Users, Pencil, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { BapsSnapshot } from "@/lib/baps/types";
import {
  conformidadeContratualPct,
  formatCompactBRLThousands,
  npsWeightedGrowthPct,
  weightedNpsForYear,
} from "@/lib/baps/executive-metrics";
import { formatCurrencyBRL, formatNumberBR, parseLooseNumber, cn } from "@/lib/utils";

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

async function saveField(table: string, payload: Record<string, unknown>) {
  await fetch("/api/baps/mutate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table, payload }),
  }).catch(() => {});
}

export function ExecutiveHero({ data }: { data: BapsSnapshot }) {
  const fin = data.financeiro_resumo;
  const assoc = data.associados_resumo;
  const nps25 = weightedNpsForYear(data, 2025);
  const growth = npsWeightedGrowthPct(data);
  const conform = conformidadeContratualPct(data);
  const procCount = data.processos.length;

  // — Card 1: Dinheiro em caixa (editável)
  const [saldo, setSaldo] = React.useState(fin.saldo_global);
  const [editSaldo, setEditSaldo] = React.useState(false);
  const [draftSaldo, setDraftSaldo] = React.useState("");
  const saldoRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => setSaldo(fin.saldo_global), [fin.saldo_global]);

  const beginSaldo = () => {
    setDraftSaldo(String(saldo).replace(".", ","));
    setEditSaldo(true);
    requestAnimationFrame(() => { saldoRef.current?.focus(); saldoRef.current?.select(); });
  };
  const commitSaldo = () => {
    const n = parseLooseNumber(draftSaldo);
    setSaldo(n);
    setEditSaldo(false);
    saveField("financeiro_resumo", { saldo_global: n });
  };

  // — Card 4: Total de associados (editável)
  const [ativos, setAtivos] = React.useState(assoc.total_ativos);
  const [editAtivos, setEditAtivos] = React.useState(false);
  const [draftAtivos, setDraftAtivos] = React.useState("");
  const ativosRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => setAtivos(assoc.total_ativos), [assoc.total_ativos]);

  const beginAtivos = () => {
    setDraftAtivos(String(ativos));
    setEditAtivos(true);
    requestAnimationFrame(() => { ativosRef.current?.focus(); ativosRef.current?.select(); });
  };
  const commitAtivos = () => {
    const n = parseLooseNumber(draftAtivos);
    setAtivos(n);
    setEditAtivos(false);
    saveField("associados_resumo", { total_ativos: n });
  };

  const growthSub =
    growth > 0
      ? `Crescimento de +${growth}% comparado ao ano passado`
      : growth < 0
        ? `Queda de ${Math.abs(growth)}% comparado ao ano passado`
        : "Estável em relação ao ano passado";

  const procSub =
    procCount > 0
      ? `${formatNumberBR(procCount)} situações sendo acompanhadas`
      : "Sem pendências registradas";

  const ativosSub =
    assoc.vencimentos_mes > 0
      ? `${formatNumberBR(assoc.vencimentos_mes)} renovações vencem este mês — atenção`
      : "Base estável neste ciclo";

  const déficitSub = `Resultado do 1º trimestre: ${formatCompactBRLThousands(fin.deficit_q1)}`;

  const cardBase =
    "group relative overflow-hidden rounded-2xl border border-border/60 bg-card/75 backdrop-blur-sm shadow-sm print:break-inside-avoid print:border print:bg-white print:shadow-none";

  return (
    <section
      aria-label="Resumo geral"
      className="executive-hero-print grid gap-3 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-2 print:gap-2"
    >
      {/* ── Card 1: Dinheiro em caixa ── */}
      <motion.div initial="hidden" animate="show" custom={0} variants={fade} className={cardBase}>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/[0.12] to-transparent opacity-90" />
        <div className="relative p-5 flex flex-col gap-3 min-h-[148px]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Landmark className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-[0.18em]">Dinheiro em caixa</span>
          </div>
          {editSaldo ? (
            <div className="flex items-center gap-2">
              <Input
                ref={saldoRef}
                value={draftSaldo}
                onChange={(e) => setDraftSaldo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitSaldo();
                  if (e.key === "Escape") setEditSaldo(false);
                }}
                onBlur={commitSaldo}
                inputMode="decimal"
                className="h-10 text-xl font-semibold tabular-nums"
              />
              <button
                onClick={commitSaldo}
                className="h-9 w-9 grid place-items-center rounded-lg bg-foreground text-background shrink-0"
                aria-label="Salvar"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={beginSaldo}
              className="group/val flex items-center gap-2 text-left"
              aria-label="Editar dinheiro em caixa"
            >
              <span className="text-2xl sm:text-[1.65rem] font-semibold tracking-tight text-foreground tabular-nums leading-tight">
                {formatCurrencyBRL(saldo)}
              </span>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/val:opacity-100 transition-opacity" />
            </button>
          )}
          <p className="text-[12px] text-muted-foreground leading-snug mt-auto">{déficitSub}</p>
        </div>
      </motion.div>

      {/* ── Card 2: Satisfação dos membros ── */}
      <motion.div initial="hidden" animate="show" custom={1} variants={fade} className={cardBase}>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal-500/[0.12] to-transparent opacity-90" />
        <div className="relative p-5 flex flex-col gap-3 min-h-[148px]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-[0.18em]">Satisfação dos membros</span>
          </div>
          <p className="text-2xl sm:text-[1.65rem] font-semibold tracking-tight text-foreground tabular-nums leading-tight">
            {nps25.toFixed(1).replace(".", ",")}
          </p>
          <p className="text-[12px] text-muted-foreground leading-snug mt-auto">{growthSub}</p>
        </div>
      </motion.div>

      {/* ── Card 3: Contratos e jurídico ── */}
      <motion.div initial="hidden" animate="show" custom={2} variants={fade} className={cardBase}>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/[0.10] to-transparent opacity-90" />
        <div className="relative p-5 flex flex-col gap-3 min-h-[148px]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Scale className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-[0.18em]">Contratos e jurídico</span>
          </div>
          <p className="text-2xl sm:text-[1.65rem] font-semibold tracking-tight text-foreground tabular-nums leading-tight">
            {conform}%
          </p>
          <p className="text-[12px] text-muted-foreground leading-snug mt-auto">{procSub}</p>
        </div>
      </motion.div>

      {/* ── Card 4: Total de associados ── */}
      <motion.div initial="hidden" animate="show" custom={3} variants={fade} className={cardBase}>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/[0.10] to-transparent opacity-90" />
        <div className="relative p-5 flex flex-col gap-3 min-h-[148px]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-[0.18em]">Total de associados</span>
          </div>
          {editAtivos ? (
            <div className="flex items-center gap-2">
              <Input
                ref={ativosRef}
                value={draftAtivos}
                onChange={(e) => setDraftAtivos(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitAtivos();
                  if (e.key === "Escape") setEditAtivos(false);
                }}
                onBlur={commitAtivos}
                inputMode="numeric"
                className="h-10 text-xl font-semibold tabular-nums"
              />
              <button
                onClick={commitAtivos}
                className="h-9 w-9 grid place-items-center rounded-lg bg-foreground text-background shrink-0"
                aria-label="Salvar"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={beginAtivos}
              className="group/val flex items-center gap-2 text-left"
              aria-label="Editar total de associados"
            >
              <span className="text-2xl sm:text-[1.65rem] font-semibold tracking-tight text-foreground tabular-nums leading-tight">
                {formatNumberBR(ativos)}
              </span>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/val:opacity-100 transition-opacity" />
            </button>
          )}
          <p className="text-[12px] text-muted-foreground leading-snug mt-auto">{ativosSub}</p>
        </div>
      </motion.div>
    </section>
  );
}
