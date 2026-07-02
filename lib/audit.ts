/**
 * Registro de auditoria — alimenta a aba de Notificações (quem alterou o quê).
 *
 * `logAudit` é best-effort: qualquer falha é engolida para nunca derrubar a
 * operação principal (uma edição não pode falhar só porque o log falhou).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditAction = "criou" | "editou" | "excluiu";

export interface AuditEntry {
  userEmail?: string | null;
  userName?: string | null;
  sector?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  summary?: string | null;
  details?: unknown;
}

export async function logAudit(sb: SupabaseClient, entry: AuditEntry): Promise<void> {
  try {
    await sb.from("portal_audit_log").insert({
      user_email: entry.userEmail ?? null,
      user_name: entry.userName ?? null,
      sector: entry.sector ?? null,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      summary: entry.summary ?? null,
      details: entry.details ?? null,
    });
  } catch {
    // silencioso — auditoria nunca bloqueia a ação do usuário
  }
}

/** Nome amigável a partir do e-mail (ex.: "miguel@portal.com" → "Miguel"). */
export function nomeAmigavel(email?: string | null): string {
  if (!email) return "Alguém";
  const local = email.split("@")[0] ?? "";
  const limpo = local.replace(/\d+/g, "").replace(/[._-]+/g, " ").trim();
  if (!limpo) return email;
  return limpo
    .split(" ")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}
