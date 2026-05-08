import type { BapsSnapshot } from "@/lib/baps/types";

const NPS_CATEGORIES = ["Doctors", "Pré/Pós", "Gestores"] as const;
/** Pesos para média ponderada do NPS consolidado (2025 vs públicos). */
const NPS_WEIGHTS = [0.38, 0.34, 0.28] as const;

export function weightedNpsForYear(data: BapsSnapshot, ano: number): number {
  let sum = 0;
  NPS_CATEGORIES.forEach((cat, i) => {
    const v = data.nps_metricas.find((n) => n.categoria === cat && n.ano === ano)?.valor ?? 0;
    sum += v * NPS_WEIGHTS[i];
  });
  return sum;
}

/** Variação percentual da média ponderada 2025 vs 2024. */
export function npsWeightedGrowthPct(data: BapsSnapshot): number {
  const a = weightedNpsForYear(data, 2024);
  const b = weightedNpsForYear(data, 2025);
  if (a <= 0) return 0;
  return Math.round(((b - a) / a) * 100);
}

/**
 * Índice sintético de conformidade contratual (carteira + riscos explícitos).
 * Pensado para comunicação à diretoria; não substitui auditoria legal.
 */
export function conformidadeContratualPct(data: BapsSnapshot): number {
  const n = data.contratos.length;
  if (n === 0) return 100;
  const risk = data.contratos.filter((c) => c.destaque_risco).length;
  const demanda = data.contratos.filter((c) => c.status === "demanda").length;
  const raw = 100 - risk * 2.5 - demanda * 1.5;
  return Math.max(72, Math.min(98, Math.round(raw)));
}

export function formatCompactBRLThousands(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const k = abs / 1000;
    return `${sign}R$ ${k.toFixed(1).replace(".", ",")}k`;
  }
  return `${sign}${new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(abs)}`;
}

export function diasDesdeEmissaoCertidao(dataUltimaEmissaoIso: string): number {
  const d = new Date(dataUltimaEmissaoIso + "T12:00:00");
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

/** Alerta ciclo semestral sugerido: ≥ 180 dias desde a última emissão. */
export function certidaoAlertaSemestral(dataUltimaEmissaoIso: string): boolean {
  return diasDesdeEmissaoCertidao(dataUltimaEmissaoIso) >= 180;
}
