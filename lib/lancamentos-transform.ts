/**
 * Transformação compartilhada de linhas de planilha (string[][]) em registros
 * de `portal_lancamentos` — usada por:
 *   - /api/cron/sync-sheets   (Google Sheets API)
 *   - /api/sync/sheets        (Google Sheets API, manual)
 *   - /api/sync/upload        (arquivo CSV/XLSX enviado manualmente)
 *   - /api/sync/onedrive      (arquivo XLSX/CSV lido de uma pasta do OneDrive)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findHeaderRowIndex,
  buildColumnMap,
  parseDateBR,
  parseMoneyBR,
} from "@/lib/google-sheets";

const BATCH_SIZE = 500;

export interface LancamentoRecord {
  cod: string;
  descricao: string | null;
  conta_caixa: string | null;
  plano_contas: string | null;
  nome_razao_social: string | null;
  forma_pagamento: string | null;
  situacao: string | null;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  data_cred_deb: string | null;
  plano_primario_contas: string | null;
  classificacao: string | null;
  sub_classificacao: string | null;
  ent_saida: string | null;
  rec_desp: string | null;
  tratativa: string | null;
  tratativa_oculta: string | null;
  evento: string | null;
  synced_at: string;
}

export interface TransformResult {
  records: LancamentoRecord[];
  rowsRead: number;
  columnsDetected: string[];
}

/** Recebe as linhas brutas da planilha (incluindo cabeçalho) e retorna os registros prontos para upsert. */
export function transformSheetRows(rawRows: string[][]): TransformResult {
  const headerIdx = findHeaderRowIndex(rawRows);
  const headers = rawRows[headerIdx] ?? [];
  const colMap = buildColumnMap(headers);
  const dataRows = rawRows.slice(headerIdx + 1);

  const now = new Date().toISOString();
  const col = (row: string[], idx: number | undefined): string =>
    idx !== undefined ? (row[idx] ?? "").trim() : "";

  const records: LancamentoRecord[] = [];

  for (const row of dataRows) {
    const cod = col(row, colMap.cod);
    if (!cod || cod.toLowerCase().includes("total")) continue;

    const rawValor = col(row, colMap.valor);
    const valorRaw = parseMoneyBR(rawValor);

    const recDespCol = col(row, colMap.rec_desp);
    const recDesp =
      recDespCol ||
      (valorRaw < 0 ? "Despesas" : valorRaw > 0 ? "Receitas" : null);

    const nomeX = col(row, colMap.nome_completo);
    const nomeW = col(row, colMap.tratativa_oculta);
    const nomeE = col(row, colMap.nome_razao_social);
    const nomeDisplay =
      (nomeX && nomeX !== "*NÃO INFORMADO*" ? nomeX : null) ||
      (nomeW && nomeW !== "*NÃO INFORMADO*" ? nomeW : null) ||
      (nomeE && nomeE !== "*NÃO INFORMADO*" ? nomeE : null) ||
      null;

    records.push({
      cod,
      descricao:             col(row, colMap.descricao)             || null,
      conta_caixa:           col(row, colMap.conta_caixa)           || null,
      plano_contas:          col(row, colMap.plano_contas)          || null,
      nome_razao_social:     nomeDisplay,
      forma_pagamento:       col(row, colMap.forma_pagamento)       || null,
      situacao:              col(row, colMap.situacao)              || null,
      valor:                 Math.abs(valorRaw),
      data_vencimento:       parseDateBR(col(row, colMap.data_vencimento)),
      data_pagamento:        parseDateBR(col(row, colMap.data_pagamento)),
      data_cred_deb:         parseDateBR(col(row, colMap.data_cred_deb)),
      plano_primario_contas: col(row, colMap.plano_primario_contas)  || null,
      classificacao:         col(row, colMap.classificacao)          || null,
      sub_classificacao:     col(row, colMap.sub_classificacao)      || null,
      ent_saida:             col(row, colMap.ent_saida)              || null,
      rec_desp:              recDesp,
      tratativa:             col(row, colMap.tratativa)              || null,
      tratativa_oculta:      col(row, colMap.tratativa_oculta)       || null,
      evento:                col(row, colMap.evento)                 || null,
      synced_at:             now,
    });
  }

  return { records, rowsRead: dataRows.length, columnsDetected: Object.keys(colMap) };
}

/**
 * Faz upsert dos registros em lotes de `portal_lancamentos` (onConflict: "cod").
 * Lança erro com o lote/mensagem em caso de falha — o chamador decide como logar.
 */
export async function upsertLancamentos(
  sb: SupabaseClient,
  records: LancamentoRecord[]
): Promise<number> {
  let totalUpserted = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await sb
      .from("portal_lancamentos")
      .upsert(batch, { onConflict: "cod" });

    if (error) {
      throw new Error(`Erro no lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`, {
        cause: { totalUpserted },
      });
    }
    totalUpserted += batch.length;
  }
  return totalUpserted;
}
