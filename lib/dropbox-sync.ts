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
import { parseSpreadsheetAndResumo } from "@/lib/file-parsers";
import { getLatestSpreadsheetFile } from "@/lib/dropbox";

export interface DropboxSyncResult {
  ok: true;
  file_name: string;
  rows_read: number;
  rows_upserted: number;
  rows_removed: number;
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
    const file = await getLatestSpreadsheetFile();
    if (!file) {
      await updateLog("error", 0, 0, "Nenhuma planilha (.xlsx/.csv) encontrada na pasta do Dropbox.");
      throw new DropboxSyncError("Nenhuma planilha (.xlsx/.csv) encontrada na pasta do Dropbox.", 422);
    }

    // Lê a planilha UMA vez só (arquivo grande) → linhas + saldos-resumo.
    const { rows: rawRows, resumo } = await parseSpreadsheetAndResumo(file.name, file.buffer);
    if (rawRows.length < 2) {
      await updateLog("error", 0, 0, "Planilha vazia ou sem dados.");
      throw new DropboxSyncError("Planilha vazia ou sem dados.", 422);
    }

    const { records, rowsRead } = transformSheetRows(rawRows);
    if (records.length === 0) {
      await updateLog("error", rowsRead, 0, "Nenhum registro válido encontrado na planilha.");
      throw new DropboxSyncError("Nenhum registro válido encontrado na planilha.", 422);
    }

    // Salva os saldos-resumo ("Saldo do Dia"/"Saldo Projetado") ANTES do upsert
    // pesado — assim o número mais visível do painel atualiza mesmo que a
    // gravação dos 50 mil lançamentos demore.
    try {
      if (resumo.saldoDia !== null || resumo.saldoProjetado !== null) {
        await sb.from("portal_planilha_resumo").upsert(
          {
            id: 1,
            saldo_dia: resumo.saldoDia,
            saldo_projetado: resumo.saldoProjetado,
            arquivo: file.name,
            atualizado_em: new Date().toISOString(),
          },
          { onConflict: "id" },
        );
      }
    } catch {
      // resumo é complementar — não falha a sincronização principal
    }

    const totalUpserted = await upsertLancamentos(sb, records);

    // Limpeza (mark-and-sweep): remove de portal_lancamentos qualquer linha
    // que NÃO veio nesta sincronização — ou seja, o Miguel corrigiu/removeu
    // esse lançamento na planilha, mas como o upsert só insere/atualiza (nunca
    // apaga), a versão antiga ficava para sempre no banco, inflando os totais
    // por evento (era exatamente por isso que o 5º Congresso não batia com a
    // base: sobravam ~70 lançamentos antigos de despesa já corrigidos pelo
    // Miguel). Todos os registros desta sincronização compartilham o mesmo
    // `synced_at`; qualquer linha mais antiga que isso é lixo de uma versão
    // anterior da planilha e pode ser removida com segurança.
    let rowsRemoved = 0;
    const syncedAt = records[0]?.synced_at;
    if (syncedAt) {
      const { count, error: deleteError } = await sb
        .from("portal_lancamentos")
        .delete({ count: "exact" })
        .lt("synced_at", syncedAt);
      if (!deleteError) rowsRemoved = count ?? 0;
    }

    await updateLog("success", rowsRead, totalUpserted);
    return { ok: true, file_name: file.name, rows_read: rowsRead, rows_upserted: totalUpserted, rows_removed: rowsRemoved };
  } catch (err: any) {
    if (err instanceof DropboxSyncError) throw err;
    const partial = (err?.cause as { totalUpserted?: number } | undefined)?.totalUpserted ?? 0;
    await updateLog("error", 0, partial, err?.message);
    throw new DropboxSyncError(err?.message ?? "Erro interno na sincronização.", 500, partial);
  }
}
