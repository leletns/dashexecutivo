/** Brazil timezone helpers (America/Sao_Paulo, UTC-3). */

const TZ = "America/Sao_Paulo";

/** Current date in Brazil as ISO string (YYYY-MM-DD). */
export function todayBrasilia(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
}

/** Current month in Brazil as YYYY-MM key. */
export function currentMonthBrasilia(): string {
  return todayBrasilia().slice(0, 7);
}

/** Format an ISO date string as DD/MM/YYYY in Brazil timezone. */
export function formatDateBR(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00Z`);
  return d.toLocaleDateString("pt-BR", { timeZone: TZ });
}
