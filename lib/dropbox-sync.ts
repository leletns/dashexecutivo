/**
 * Sincronização Dropbox → Supabase compartilhada.
 *
 * Baixa a planilha mais recente da pasta do Dropbox, converte e faz upsert em
 * portal_lancamentos. Usada por três gatilhos:
 *   - /api/sync/dropbox        (manual, pelo financeiro)
 *   - /api/cron/sync-dropbox   (agendado, Vercel Cron)
 *   - /api/webhooks/dropbox    (tempo real, quando o arquivo muda na pasta)
 *
 * Centralizar aqui evita divergência entre os três caminhos.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { transformSheetRows, upsertLancamentos } from "@/lib/lancamentos-transform";
import { parseSpreadsheetFile } from "@/lib/file-parsers";
import { findLatestSpreadsheet, downloadFileContent } from "@/lib/dropbox";

export interface DropboxSyncResult {
  ok: true;
  file_name: string;
  rows_read: number;
  rows_upserted: number;
}

export class DropboxSyncError extends Error {
  status: number;
  rowsUpserted: number;
  constructor(message: string, status = 500, rowsUpserted = 0) {
    super(message);
    this.name = "DropboxSyncError";
    this.status = status;
    this.rowsUpserted = rowsUpserted;
  }
}

/**
 * Executa a sincronização completa, registrando início/fim em
 * portal_sheets_sync_log. Lança DropboxSyncError em falhas (com status HTTP
 * sugerido). O upsert é idempotente (onConflict: cod), então reexecuções —
 * inclusive retentativas do webhook do Dropbox — são seguras.
 */
export async function runDropboxSync(
  sb: SupabaseClient,
  triggeredBy: string,
): Promise<DropboxSyncResult> {
  const { data: logRow } = await sb
    .from("portal_sheets_sync_log")
    .insert({
      started_at: new Date().toISOString(),
      status: "running",
      triggered_by: triggeredBy,
    })
    .select("id")
    .single();
  const logId = logRow?.id as string | undefined;

  const updateLog = async (
    status: "success" | "error",
    rowsRead: number,
    rowsUpserted: number,
    errorMessage?: string,
  ) => {
    if (!logId) return;
    await sb
      .from("portal_sheets_sync_log")
      .update({
        finished_at: new Date().toISOString(),
        status,
        rows_read: rowsRead,
        rows_upserted: rowsUpserted,
        error_message: errorMessage ?? null,
      })
      .eq("id", logId);
  };

  try {
    const file = await findLatestSpreadsheet();
    if (!file) {
      await updateLog("error", 0, 0, "Nenhuma planilha (.xlsx/.csv) encontrada na pasta do Dropbox.");
      throw new DropboxSyncError("Nenhuma planilha (.xlsx/.csv) encontrada na pasta do Dropbox.", 422);
    }

    const buffer = await downloadFileContent(file.pathLower);
    const rawRows = await parseSpreadsheetFile(file.name, buffer);
    if (rawRows.length < 2) {
      await updateLog("error", 0, 0, "Planilha vazia ou sem dados.");
      throw new DropboxSyncError("Planilha vazia ou sem dados.", 422);
    }

    const { records, rowsRead } = transformSheetRows(rawRows);
    if (records.length === 0) {
      await updateLog("error", rowsRead, 0, "Nenhum registro válido encontrado na planilha.");
      throw new DropboxSyncError("Nenhum registro válido encontrado na planilha.", 422);
    }

    const totalUpserted = await upsertLancamentos(sb, records);
    await updateLog("success", rowsRead, totalUpserted);
    return { ok: true, file_name: file.name, rows_read: rowsRead, rows_upserted: totalUpserted };
  } catch (err: any) {
    if (err instanceof DropboxSyncError) throw err;
    const partial = (err?.cause as { totalUpserted?: number } | undefined)?.totalUpserted ?? 0;
    await updateLog("error", 0, partial, err?.message);
    throw new DropboxSyncError(err?.message ?? "Erro interno na sincronização.", 500, partial);
  }
}
