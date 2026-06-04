/**
 * GET /api/cron/sync-sheets
 *
 * Endpoint chamado automaticamente pelo Vercel Cron (vercel.json)
 * e pelo Google Apps Script da planilha.
 *
 * Autenticação: Authorization: Bearer <CRON_SECRET>
 * Executa a mesma sincronização Google Sheets → Supabase do endpoint manual.
 *
 * Configure em Vercel → Settings → Environment Variables:
 *   CRON_SECRET = qualquer string longa e aleatória
 */

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  readSheetValues,
  findHeaderRowIndex,
  buildColumnMap,
  parseDateBR,
} from "@/lib/google-sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 500;

export async function GET(req: Request) {
  return handleSync(req);
}

export async function POST(req: Request) {
  return handleSync(req);
}

async function handleSync(req: Request) {
  // ── Auth via CRON_SECRET ───────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

  if (token !== cronSecret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // ── Verifica variáveis ────────────────────────────────────────────────────
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME ?? "personalizadoFinanceiro (13)";

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64 || !spreadsheetId) {
    return NextResponse.json({
      error: "Google Sheets não configurado. Adicione GOOGLE_SERVICE_ACCOUNT_KEY_B64 e GOOGLE_SHEETS_SPREADSHEET_ID.",
    }, { status: 503 });
  }

  const sb = createSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });

  // ── Log de início ─────────────────────────────────────────────────────────
  const { data: logRow } = await sb
    .from("portal_sheets_sync_log")
    .insert({
      started_at: new Date().toISOString(),
      status: "running",
      triggered_by: "cron:auto",
    })
    .select("id")
    .single();
  const logId = logRow?.id as string | undefined;

  const updateLog = async (
    status: "success" | "error",
    rowsRead: number,
    rowsUpserted: number,
    errorMessage?: string
  ) => {
    if (!logId) return;
    await sb.from("portal_sheets_sync_log").update({
      finished_at: new Date().toISOString(),
      status,
      rows_read: rowsRead,
      rows_upserted: rowsUpserted,
      error_message: errorMessage ?? null,
    }).eq("id", logId);
  };

  // ── 1. Lê planilha ────────────────────────────────────────────────────────
  let rawRows: string[][];
  try {
    rawRows = await readSheetValues(spreadsheetId, sheetName);
  } catch (err: any) {
    await updateLog("error", 0, 0, err?.message);
    return NextResponse.json({ error: `Erro ao ler planilha: ${err?.message}` }, { status: 502 });
  }

  if (rawRows.length === 0) {
    await updateLog("error", 0, 0, "Planilha vazia.");
    return NextResponse.json({ error: "Planilha vazia." }, { status: 422 });
  }

  // ── 2. Detecta cabeçalho ──────────────────────────────────────────────────
  const headerIdx = findHeaderRowIndex(rawRows);
  const headers = rawRows[headerIdx] ?? [];
  const colMap = buildColumnMap(headers);
  const dataRows = rawRows.slice(headerIdx + 1);

  // ── 3. Transforma linhas ──────────────────────────────────────────────────
  const now = new Date().toISOString();
  const col = (row: string[], idx: number | undefined): string =>
    idx !== undefined ? (row[idx] ?? "").trim() : "";

  const records = [];

  for (const row of dataRows) {
    const cod = col(row, colMap.cod);
    if (!cod || cod.toLowerCase().includes("total")) continue;

    const rawValor = col(row, colMap.valor);
    const valorRaw =
      parseFloat(rawValor.replace(/R\$\s?/, "").replace(/\./g, "").replace(",", ".")) || 0;

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

  // ── 4. Upsert em lotes ────────────────────────────────────────────────────
  let totalUpserted = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await sb
      .from("portal_lancamentos")
      .upsert(batch, { onConflict: "cod" });

    if (error) {
      await updateLog("error", dataRows.length, totalUpserted, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    totalUpserted += batch.length;
  }

  await updateLog("success", dataRows.length, totalUpserted);

  return NextResponse.json({
    ok: true,
    rows_read: dataRows.length,
    rows_upserted: totalUpserted,
    triggered_at: now,
  });
}
