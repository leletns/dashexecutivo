import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrencyBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatNumberBR(value: number) {
  return new Intl.NumberFormat("pt-BR").format(
    Number.isFinite(value) ? value : 0,
  );
}

/**
 * Valor compacto em reais, pronto para escala de milhões, bilhões e trilhões.
 * Ex.: 2273448 → "R$ 2,27 mi" · 1500000000 → "R$ 1,5 bi" · 850 → "R$ 850".
 * Abaixo de mil mostra o valor cheio (sem centavos, como o resto do painel).
 */
export function formatCompactBRL(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);

  const scaled = (n: number, suffix: string) =>
    `${sign}R$ ${n.toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })} ${suffix}`;

  if (abs >= 1_000_000_000_000) return scaled(abs / 1_000_000_000_000, "tri");
  if (abs >= 1_000_000_000) return scaled(abs / 1_000_000_000, "bi");
  if (abs >= 1_000_000) return scaled(abs / 1_000_000, "mi");
  if (abs >= 1_000)
    return `${sign}R$ ${(abs / 1_000).toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })} mil`;
  return formatCurrencyBRL(v);
}

export function parseLooseNumber(input: string): number {
  if (!input) return 0;
  const cleaned = input
    .replace(/[^0-9,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
