"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale,
  DollarSign,
  BarChart3,
  Calendar,
  Users,
  Building2,
  TrendingUp,
  TrendingDown,
  ChevronRight,
} from "lucide-react";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import type { BapsSnapshot } from "@/lib/baps/types";
import {
  npsWeightedGrowthPct,
  weightedNpsForYear,
  conformidadeContratualPct,
} from "@/lib/baps/executive-metrics";

// ─── Types ────────────────────────────────────────────────────────────────────

type HealthLevel = "excelente" | "estavel" | "atencao" | "critico";
type DeptStatus = "ok" | "atencao" | "critico";

interface DeptData {
  key: string;
  label: string;
  icon: React.ElementType;
  href: string;
  status: DeptStatus;
  metric: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoVencido(previsaoIso: string): boolean {
  return new Date(previsaoIso + "T12:00:00") < new Date();
}

function isoAlerta(previsaoIso: string): boolean {
  const prev = new Date(previsaoIso + "T12:00:00");
  const ms = prev.getTime() - Date.now();
  return ms > 0 && ms / (1000 * 60 * 60 * 24 * 30.44) <= 6;
}

function computeHealthLevel(data: BapsSnapshot): HealthLevel {
  const riscos = data.contratos.filter((c) => c.destaque_risco).length;
  const altosRiscos = data.processos.filter((p) => p.nivel_risco === "alto").length;
  const certVencidas = data.certidoes.filter((c) => isoVencido(c.previsao_proxima)).length;
  const npsGrowth = npsWeightedGrowthPct(data);
  const institucionalOk =
    data.institucional.atas_procuracoes_ok && data.institucional.regimento_interno_ok;

  if (altosRiscos >= 3 || riscos >= 4 || certVencidas >= 2 || npsGrowth <= -10) return "critico";
  if (altosRiscos >= 1 || riscos >= 2 || !institucionalOk || certVencidas >= 1 || npsGrowth < 0)
    return "atencao";
  if (altosRiscos === 0 && riscos === 0 && certVencidas === 0 && npsGrowth >= 5) return "excelente";
  return "estavel";
}

function computeBullets(data: BapsSnapshot): string[] {
  const riscos = data.contratos.filter((c) => c.destaque_risco).length;
  const altosRiscos = data.processos.filter((p) => p.nivel_risco === "alto").length;
  const certVencidas = data.certidoes.filter((c) => isoVencido(c.previsao_proxima)).length;
  const npsGrowth = npsWeightedGrowthPct(data);
  const nps25 = weightedNpsForYear(data, 2025);
  const churnPct =
    data.associados_resumo.total_ativos > 0
      ? Math.round(
          (data.associados_resumo.saidas_ytd / data.associados_resumo.total_ativos) * 100,
        )
      : 0;
  const institucionalOk =
    data.institucional.atas_procuracoes_ok && data.institucional.regimento_interno_ok;

  const bullets: string[] = [];

  if (nps25 > 0) {
    bullets.push(
      npsGrowth > 0
        ? `Satisfação ${nps25.toFixed(0)} — crescimento de +${npsGrowth}% sobre o ano passado`
        : npsGrowth < 0
          ? `Satisfação ${nps25.toFixed(0)} — queda de ${Math.abs(npsGrowth)}% sobre o ano passado`
          : `Satisfação ${nps25.toFixed(0)} — estável em relação ao ano passado`,
    );
  }

  if (riscos > 0 || altosRiscos > 0) {
    const parts: string[] = [];
    if (riscos > 0) parts.push(`${riscos} contrato${riscos > 1 ? "s" : ""} de atenção`);
    if (altosRiscos > 0)
      parts.push(`${altosRiscos} processo${altosRiscos > 1 ? "s" : ""} de alto risco`);
    bullets.push(parts.join(" · "));
  } else {
    bullets.push("Carteira jurídica sem contratos de risco ativo");
  }

  if (!institucionalOk) {
    bullets.push("Pendências institucionais — atas ou regimento interno em revisão");
  } else if (certVencidas > 0) {
    bullets.push(
      `${certVencidas} certidão${certVencidas > 1 ? "ões" : ""} vencida${certVencidas > 1 ? "s" : ""} — renovação urgente`,
    );
  } else {
    bullets.push(`Compliance ok · churn ${churnPct}% no acumulado do ano`);
  }

  return bullets;
}

function computeDepts(data: BapsSnapshot): DeptData[] {
  const npsGrowth = npsWeightedGrowthPct(data);
  const churnHigh =
    data.associados_resumo.total_ativos > 0 &&
    data.associados_resumo.saidas_ytd / data.associados_resumo.total_ativos > 0.05;
  const trilhasCritical = data.evento_trilhas.filter((t) => t.status === "critical").length;
  const trilhasWarning = data.evento_trilhas.filter((t) => t.status === "warning").length;
  const processosAlto = data.processos.filter((p) => p.nivel_risco === "alto").length;
  const contratoRisco = data.contratos.filter((c) => c.destaque_risco).length;
  const certVencidas = data.certidoes.filter((c) => isoVencido(c.previsao_proxima)).length;
  const certAlertas = data.certidoes.filter((c) => isoAlerta(c.previsao_proxima)).length;
  const institucionalOk =
    data.institucional.atas_procuracoes_ok && data.institucional.regimento_interno_ok;
  const conform = conformidadeContratualPct(data);
  const fin = data.financeiro_resumo;

  return [
    {
      key: "adm",
      label: "Administrativo",
      icon: Building2,
      href: "/administrativo",
      status:
        certVencidas > 0 ? "critico" : !institucionalOk || certAlertas > 0 ? "atencao" : "ok",
      metric: institucionalOk ? "Tudo em dia" : "Itens pendentes",
    },
    {
      key: "fin",
      label: "Financeiro",
      icon: DollarSign,
      href: "/financeiro",
      status: fin.saldo_global < 0 ? "critico" : fin.deficit_q1 < -150000 ? "atencao" : "ok",
      metric: formatCurrencyBRL(fin.saldo_global),
    },
    {
      key: "jur",
      label: "Jurídico",
      icon: Scale,
      href: "/juridico",
      status:
        processosAlto >= 2 || contratoRisco >= 3
          ? "critico"
          : processosAlto >= 1 || contratoRisco >= 1
            ? "atencao"
            : "ok",
      metric: `${conform}% em dia`,
    },
    {
      key: "conta",
      label: "Contábil",
      icon: BarChart3,
      href: "/contabil",
      status: fin.saldo_global < 0 ? "critico" : certAlertas > 0 ? "atencao" : "ok",
      metric: certAlertas > 0 ? `${certAlertas} alerta${certAlertas > 1 ? "s" : ""}` : "Em dia",
    },
    {
      key: "mkt",
      label: "Marketing",
      icon: Users,
      href: "/marketing",
      status: npsGrowth < -5 || churnHigh ? "critico" : npsGrowth < 0 ? "atencao" : "ok",
      metric: npsGrowth >= 0 ? `Satisfação +${npsGrowth}%` : `Satisfação ${npsGrowth}%`,
    },
    {
      key: "eventos",
      label: "Eventos",
      icon: Calendar,
      href: "/eventos",
      status:
        trilhasCritical > 0 ? "critico" : trilhasWarning > 0 ? "atencao" : "ok",
      metric:
        data.evento_trilhas.length > 0 ? `${data.evento_trilhas.length} trilhas` : "Congresso",
    },
  ];
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<
  HealthLevel,
  { bg: string; border: string; dot: string; text: string; badge: string; title: string }
> = {
  excelente: {
    bg: "from-emerald-500/[0.06] to-transparent",
    border: "border-emerald-500/25",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    title: "Empresa em crescimento",
  },
  estavel: {
    bg: "from-violet-500/[0.05] to-transparent",
    border: "border-violet-500/20",
    dot: "bg-violet-500",
    text: "text-violet-700 dark:text-violet-300",
    badge: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
    title: "Empresa estável",
  },
  atencao: {
    bg: "from-amber-500/[0.06] to-transparent",
    border: "border-amber-500/25",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    title: "Atenção necessária",
  },
  critico: {
    bg: "from-red-500/[0.06] to-transparent",
    border: "border-red-500/25",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    badge: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    title: "Situação crítica",
  },
};

const DEPT_DOT: Record<DeptStatus, string> = {
  ok: "bg-emerald-500",
  atencao: "bg-amber-500",
  critico: "bg-red-500",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CompanyHealth({ data }: { data: BapsSnapshot }) {
  const router = useRouter();
  const depts = computeDepts(data);
  const npsGrowth = npsWeightedGrowthPct(data);

  return (
    <section aria-label="Panorama por área" className="space-y-2">
      {/* ── Department grid ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, filter: "blur(4px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/60">
          Panorama por área
        </p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
          {depts.map((dept, i) => {
            const Icon = dept.icon;
            return (
              <motion.button
                key={dept.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: i * 0.04,
                  duration: 0.3,
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => router.push(dept.href)}
                className={cn(
                  "group relative flex flex-col gap-2 rounded-xl border border-border/40 bg-card/50",
                  "px-3.5 py-3 text-left backdrop-blur-sm",
                  "transition-colors duration-150",
                  "hover:border-border/80 hover:bg-card",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  dept.status === "critico" && "border-red-500/20 hover:border-red-500/40",
                  dept.status === "atencao" && "border-amber-500/15 hover:border-amber-500/35",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground/50" />
                  <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", DEPT_DOT[dept.status])} />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-foreground leading-none">
                    {dept.label}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground tabular-nums leading-none">
                    {dept.metric}
                  </p>
                </div>
                <ChevronRight className="absolute right-2 bottom-2.5 h-3 w-3 text-muted-foreground/0 transition-all duration-150 group-hover:text-muted-foreground/40" />
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* ── NPS trend micro-indicator ───────────────────────────────────── */}
      {npsGrowth !== 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60"
        >
          {npsGrowth > 0 ? (
            <TrendingUp className="h-3 w-3 text-emerald-500" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-500" />
          )}
          <span>
            Satisfação dos membros{" "}
            {npsGrowth > 0 ? `+${npsGrowth}%` : `${npsGrowth}%`} vs. ano passado
          </span>
        </motion.div>
      )}
    </section>
  );
}
