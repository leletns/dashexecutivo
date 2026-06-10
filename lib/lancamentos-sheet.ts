/**
 * Leitura compartilhada da planilha Google Sheets (aba e-Gestor) — usada por
 * todas as rotas que precisam dos lançamentos financeiros (fluxo, ledger).
 *
 * Mantém um único cache em memória de 45s para não buscar a planilha em
 * duplicidade quando várias rotas são chamadas em sequência.
 */

import * as XLSX from "xlsx";
import { findHeaderRowIndex, buildColumnMap, parseDateBR, parseMoneyBR } from "@/lib/google-sheets";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const CACHE_TTL_MS = 45_000;

export type LancamentoRow = {
  cod: string | null;
  descricao: string | null;
  nome: string | null;
  conta_caixa: string | null;
  plano_contas: string | null;
  plano_primario_contas: string | null;
  classificacao: string | null;
  sub_classificacao: string | null;
  forma_pagamento: string | null;
  situacao: string | null;
  ent_saida: string | null;
  rec_desp: string | null;
  tratativa: string | null;
  evento: string | null;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  data_cred_deb: string | null;
};

let sheetCache: { at: number; rows: LancamentoRow[] } | null = null;

/** Busca o export CSV público da aba — funciona com a planilha "compartilhada por link". */
async function fetchPublicSheetRows(spreadsheetId: string, sheetName: string): Promise<string[][]> {
  const url =
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq` +
    `?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `Não foi possível ler a planilha pública (HTTP ${res.status}). ` +
      `Verifique se ela está compartilhada como "Qualquer pessoa com o link pode ver".`
    );
  }
  const csv = await res.text();
  if (csv.trim().startsWith("<")) {
    throw new Error(
      `A planilha não está acessível publicamente. ` +
      `Compartilhe-a como "Qualquer pessoa com o link pode ver" e tente novamente.`
    );
  }

  const wb = XLSX.read(csv, { type: "string" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, blankrows: false }) as string[][];
}

/** Lê e normaliza a planilha — retorna null se não estiver configurada (GOOGLE_SHEETS_SPREADSHEET_ID ausente). */
export async function getLancamentosFromSheet(): Promise<LancamentoRow[] | null> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME ?? "personalizadoFinanceiro (13)";
  if (!spreadsheetId) return null;

  if (sheetCache && Date.now() - sheetCache.at < CACHE_TTL_MS) {
    return sheetCache.rows;
  }

  const rawRows = await fetchPublicSheetRows(spreadsheetId, sheetName);
  if (rawRows.length === 0) {
    throw new Error(
      `A aba "${sheetName}" foi encontrada mas está vazia (0 linhas). ` +
      `Confira se o nome da aba em GOOGLE_SHEETS_SHEET_NAME é exatamente igual ao nome exibido na planilha.`
    );
  }

  const headerIdx = findHeaderRowIndex(rawRows);
  const headers = rawRows[headerIdx] ?? [];
  const colMap = buildColumnMap(headers);
  const dataRows = rawRows.slice(headerIdx + 1);

  if (colMap.cod === undefined) {
    const amostraCabecalho = headers.filter(Boolean).slice(0, 8).join(" | ") || "(linha vazia)";
    throw new Error(
      `Conectou na aba "${sheetName}" (${rawRows.length} linhas), mas não encontrou a coluna "Cód." no ` +
      `cabeçalho detectado na linha ${headerIdx + 1}: [${amostraCabecalho}]. ` +
      `Provavelmente o nome da aba (GOOGLE_SHEETS_SHEET_NAME) está apontando para a aba errada.`
    );
  }

  const col = (row: string[], idx: number | undefined): string =>
    idx !== undefined ? (row[idx] ?? "").trim() : "";

  const rows: LancamentoRow[] = [];
  for (const row of dataRows) {
    const cod = col(row, colMap.cod);
    if (!cod || cod.toLowerCase().includes("total")) continue;

    const rawValor = col(row, colMap.valor);
    const valorRaw = parseMoneyBR(rawValor);

    const recDespCol = col(row, colMap.rec_desp);
    const recDesp =
      recDespCol || (valorRaw < 0 ? "Despesas" : valorRaw > 0 ? "Receitas" : null);

    const nome = col(row, colMap.nome_completo) || col(row, colMap.nome_razao_social) || null;

    rows.push({
      cod,
      descricao:             col(row, colMap.descricao) || null,
      nome,
      conta_caixa:           col(row, colMap.conta_caixa) || null,
      plano_contas:          col(row, colMap.plano_contas) || null,
      plano_primario_contas: col(row, colMap.plano_primario_contas) || null,
      classificacao:         col(row, colMap.classificacao) || null,
      sub_classificacao:     col(row, colMap.sub_classificacao) || null,
      forma_pagamento:       col(row, colMap.forma_pagamento) || null,
      situacao:              col(row, colMap.situacao) || null,
      ent_saida:             col(row, colMap.ent_saida) || null,
      rec_desp:              recDesp,
      tratativa:             col(row, colMap.tratativa) || null,
      evento:                col(row, colMap.evento) || null,
      valor:                 Math.abs(valorRaw),
      data_vencimento:       parseDateBR(col(row, colMap.data_vencimento)),
      data_pagamento:        parseDateBR(col(row, colMap.data_pagamento)),
      data_cred_deb:         parseDateBR(col(row, colMap.data_cred_deb)),
    });
  }

  if (rows.length === 0) {
    const amostraCod = dataRows.slice(0, 3).map((r) => col(r, colMap.cod) || "(vazio)").join(", ");
    throw new Error(
      `Conectou na aba "${sheetName}" e achou a coluna "Cód.", mas nenhuma das ${dataRows.length} linhas ` +
      `de dados passou no filtro (ex.: primeiros valores de Cód. encontrados: ${amostraCod}). ` +
      `A aba pode estar com cabeçalho em outra linha do que o esperado.`
    );
  }

  sheetCache = { at: Date.now(), rows };
  return rows;
}

/** Fallback: lê portal_lancamentos no Supabase (alimentado via Apps Script). */
export async function getLancamentosFromSupabase(): Promise<LancamentoRow[]> {
  const sb = createSupabaseAdmin();
  if (!sb) return [];

  const { data } = await sb
    .from("portal_lancamentos")
    .select(
      "cod, descricao, nome_razao_social, conta_caixa, plano_contas, plano_primario_contas, " +
        "classificacao, sub_classificacao, forma_pagamento, situacao, ent_saida, rec_desp, " +
        "tratativa, evento, valor, data_vencimento, data_pagamento, data_cred_deb"
    );

  return (data ?? []).map((r: any) => ({
    cod: r.cod ?? null,
    descricao: r.descricao ?? null,
    nome: r.nome_razao_social ?? null,
    conta_caixa: r.conta_caixa ?? null,
    plano_contas: r.plano_contas ?? null,
    plano_primario_contas: r.plano_primario_contas ?? null,
    classificacao: r.classificacao ?? null,
    sub_classificacao: r.sub_classificacao ?? null,
    forma_pagamento: r.forma_pagamento ?? null,
    situacao: r.situacao ?? null,
    ent_saida: r.ent_saida ?? null,
    rec_desp: r.rec_desp ?? null,
    tratativa: r.tratativa ?? null,
    evento: r.evento ?? null,
    valor: Number(r.valor) || 0,
    data_vencimento: r.data_vencimento ?? null,
    data_pagamento: r.data_pagamento ?? null,
    data_cred_deb: r.data_cred_deb ?? null,
  })) as LancamentoRow[];
}

/** Lê a planilha com fallback automático para o Supabase. Retorna a fonte usada. */
export async function getLancamentos(): Promise<{ rows: LancamentoRow[]; fonte: "planilha" | "supabase"; aviso: string | null }> {
  try {
    const rows = await getLancamentosFromSheet();
    if (rows) return { rows, fonte: "planilha", aviso: null };
  } catch (err: any) {
    const rows = await getLancamentosFromSupabase();
    return {
      rows,
      fonte: "supabase",
      aviso: `A planilha não pôde ser usada agora: ${err?.message ?? "erro desconhecido"} — mostrando os últimos dados salvos.`,
    };
  }

  const rows = await getLancamentosFromSupabase();
  return { rows, fonte: "supabase", aviso: null };
}
