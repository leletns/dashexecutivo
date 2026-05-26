/**
 * POST /api/sync/sheets   — dispara sincronização Google Sheets → Supabase
 * GET  /api/sync/sheets   — retorna status do último sync
 *
 * Acesso restrito a setores: financeiro, executivo
 */

import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/auth-server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  readSheetValues,
  findHeaderRowIndex,
  buildColumnMap,
  parseDateBR,
  parseValueBR,
} from "@/lib/google-sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tamanho dos lotes para upsert no Supabase
const BATCH_SIZE = 500;

// Setores autorizados
const WRITE_SECTORS = new Set(["financeiro", "executivo"]);

// ─── GET — status do último sync ─────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const sb = createSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });

    const { data: lastSync } = await sb
      .from("portal_sheets_sync_log")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { count: totalLancamentos } = await sb
      .from("portal_lancamentos")
      .select("*", { count: "exact", head: true });

    const configured =
      !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64 &&
      !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    return NextResponse.json({
      configured,
      last_sync: lastSync ?? null,
      total_lancamentos: totalLancamentos ?? 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}

// ─── POST — executar sync ─────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const sector = (portal as any).sector ?? "";
    if (!WRITE_SECTORS.has(sector)) {
      return NextResponse.json({ error: "Sem permissão para sincronização." }, { status: 403 });
    }

    // Valida configuração
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const sheetName =
      process.env.GOOGLE_SHEETS_SHEET_NAME ?? "personalizadoFinanceiro (13)";

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64 || !spreadsheetId) {
      return NextResponse.json(
        {
          error:
            "Google Sheets não configurado. Adicione GOOGLE_SERVICE_ACCOUNT_KEY_B64 e " +
            "GOOGLE_SHEETS_SPREADSHEET_ID nas variáveis de ambiente.",
        },
        { status: 503 }
      );
    }

    const sb = createSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });

    // Cria registro de log
    const startedAt = new Date().toISOString();
    const { data: logRow } = await sb
      .from("portal_sheets_sync_log")
      .insert({
        started_at: startedAt,
        status: "running",
        triggered_by: (portal as any).email ?? "desconhecido",
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

    // ── 1. Lê a planilha ──────────────────────────────────────────────────────
    let rawRows: string[][];
    try {
      rawRows = await readSheetValues(spreadsheetId, sheetName);
    } catch (err: any) {
      await updateLog("error", 0, 0, err?.message);
      return NextResponse.json({ error: `Erro ao ler planilha: ${err?.message}` }, { status: 502 });
    }

    if (rawRows.length === 0) {
      await updateLog("error", 0, 0, "Planilha vazia ou sem dados.");
      return NextResponse.json({ error: "Planilha vazia." }, { status: 422 });
    }

    // ── 2. Detecta cabeçalho ──────────────────────────────────────────────────
    const headerIdx = findHeaderRowIndex(rawRows);
    const headers = rawRows[headerIdx] ?? [];
    const colMap = buildColumnMap(headers);
    const dataRows = rawRows.slice(headerIdx + 1);

    // ── 3. Transforma linhas ──────────────────────────────────────────────────
    interface LancamentoRow {
      cod: string;
      data_competencia: string | null;
      data_pagamento: string | null;
      data_vencimento: string | null;
      nome_razao_social: string | null;
      evento: string | null;
      plano_primario_contas: string | null;
      classificacao: string | null;
      sub_classificacao: string | null;
      rec_desp: string | null;
      ent_saida: string | null;
      situacao: string | null;
      valor: number;
      conta_caixa: string | null;
      synced_at: string;
    }

    const now = new Date().toISOString();
    const records: LancamentoRow[] = [];

    for (const row of dataRows) {
      const cod =
        colMap.cod !== undefined ? (row[colMap.cod] ?? "").trim() : "";

      // Ignora linhas sem Cód. (linhas vazias ou subtotais)
      if (!cod || cod === "" || cod.toLowerCase().includes("total")) continue;

      records.push({
        cod,
        data_competencia:
          colMap.data_competencia !== undefined
            ? parseDateBR(row[colMap.data_competencia] ?? "")
            : null,
        data_pagamento:
          colMap.data_pagamento !== undefined
            ? parseDateBR(row[colMap.data_pagamento] ?? "")
            : null,
        data_vencimento:
          colMap.data_vencimento !== undefined
            ? parseDateBR(row[colMap.data_vencimento] ?? "")
            : null,
        nome_razao_social:
          colMap.nome_razao_social !== undefined
            ? (row[colMap.nome_razao_social] ?? "").trim() || null
            : null,
        evento:
          colMap.evento !== undefined
            ? (row[colMap.evento] ?? "").trim() || null
            : null,
        plano_primario_contas:
          colMap.plano_primario_contas !== undefined
            ? (row[colMap.plano_primario_contas] ?? "").trim() || null
            : null,
        classificacao:
          colMap.classificacao !== undefined
            ? (row[colMap.classificacao] ?? "").trim() || null
            : null,
        sub_classificacao:
          colMap.sub_classificacao !== undefined
            ? (row[colMap.sub_classificacao] ?? "").trim() || null
            : null,
        rec_desp:
          colMap.rec_desp !== undefined
            ? (row[colMap.rec_desp] ?? "").trim() || null
            : null,
        ent_saida:
          colMap.ent_saida !== undefined
            ? (row[colMap.ent_saida] ?? "").trim() || null
            : null,
        situacao:
          colMap.situacao !== undefined
            ? (row[colMap.situacao] ?? "").trim() || null
            : null,
        valor:
          colMap.valor !== undefined
            ? parseValueBR(row[colMap.valor] ?? "")
            : 0,
        conta_caixa:
          colMap.conta_caixa !== undefined
            ? (row[colMap.conta_caixa] ?? "").trim() || null
            : null,
        synced_at: now,
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
        return NextResponse.json(
          { error: `Erro ao salvar lote ${i / BATCH_SIZE + 1}: ${error.message}` },
          { status: 500 }
        );
      }
      totalUpserted += batch.length;
    }

    // ── 5. Finaliza log ───────────────────────────────────────────────────────
    await updateLog("success", dataRows.length, totalUpserted);

    return NextResponse.json({
      ok: true,
      rows_read: dataRows.length,
      rows_upserted: totalUpserted,
      header_row: headerIdx,
      columns_detected: Object.keys(colMap),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}
