"use client";

import { motion } from "framer-motion";
import { Landmark, Scale, Sparkles, Users } from "lucide-react";
import type { BapsSnapshot } from "@/lib/baps/types";
import {
  conformidadeContratualPct,
  formatCompactBRLThousands,
  npsWeightedGrowthPct,
  weightedNpsForYear,
} from "@/lib/baps/executive-metrics";
import { formatCurrencyBRL, formatNumberBR, cn } from "@/lib/utils";

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

export function ExecutiveHero({ data }: { data: BapsSnapshot }) {
  const fin = data.financeiro_resumo;
  const assoc = data.associados_resumo;
  const nps25 = weightedNpsForYear(data, 2025);
  const growth = npsWeightedGrowthPct(data);
  const conform = conformidadeContratualPct(data);
  const procCount = data.processos.length;

  const cards = [
    {
      icon: Landmark,
      title: "Liquidez Global",
      value: formatCurrencyBRL(fin.saldo_global),
      sub: `Déficit Q1: ${formatCompactBRLThousands(fin.deficit_q1)} (alinhado com antecipação de eventos)`,
      accent: "from-violet-500/[0.12] to-transparent",
    },
    {
      icon: Sparkles,
      title: "Satisfação geral (NPS)",
      value: nps25.toFixed(1).replace(".", ","),
      sub: `Média ponderada · crescimento de +${growth}% em relação a 2024`,
      accent: "from-teal-500/[0.12] to-transparent",
    },
    {
      icon: Scale,
      title: "Conformidade contratual",
      value: `${conform}%`,
      sub: `${formatNumberBR(procCount)} processos em monitoramento ativo (Mtech, TGMED, carteira judicial e extrajudicial)`,
      accent: "from-amber-500/[0.10] to-transparent",
    },
    {
      icon: Users,
      title: "Base de associados",
      value: formatNumberBR(assoc.total_ativos),
      sub:
        assoc.vencimentos_mes > 0
          ? `Alerta: ${formatNumberBR(assoc.vencimentos_mes)} renovações com vencimento neste mês · dados sincronizados com Supabase`
          : "Base estável neste ciclo · dados sincronizados com Supabase",
      accent: "from-sky-500/[0.10] to-transparent",
    },
  ];

  return (
    <section
      aria-label="Visão geral executiva"
      className="executive-hero-print grid gap-3 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-2 print:gap-2"
    >
      {cards.map((c, i) => (
        <motion.div
          key={c.title}
          initial="hidden"
          animate="show"
          custom={i}
          variants={fade}
          className={cn(
            "group relative overflow-hidden rounded-2xl border border-border/60 bg-card/75 backdrop-blur-sm shadow-sm",
            "print:break-inside-avoid print:border print:bg-white print:shadow-none",
          )}
        >
          <div
            className={cn(
              "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90",
              c.accent,
            )}
          />
          <div className="relative p-5 flex flex-col gap-3 min-h-[148px]">
            <div className="flex items-center gap-2 text-muted-foreground">
              <c.icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              <span className="text-[11px] font-medium uppercase tracking-[0.18em]">{c.title}</span>
            </div>
            <p className="text-2xl sm:text-[1.65rem] font-semibold tracking-tight text-foreground tabular-nums leading-tight">
              {c.value}
            </p>
            <p className="text-[12px] text-muted-foreground leading-snug mt-auto">{c.sub}</p>
          </div>
        </motion.div>
      ))}
    </section>
  );
}
