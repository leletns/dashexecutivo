/**
 * POST /api/sync/upload
 *
 * Importa lançamentos diretamente de um arquivo CSV ou XLSX
 * (sem precisar de Google Sheets / Conta de Serviço).
 *
 * Body: multipart/form-data com campo "file"
 * Acesso restrito a setores: financeiro, executivo
 */

import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/auth-server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getPortalSectorFromEmail } from "@/lib/portal-sector";
import {
  findHeaderRowIndex,
  buildColumnMap,
  parseDateBR,
} from "@/lib/google-sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 500;
const WRITE_SECTORS = new Set(["financeiro", "executivo"]);
const MAX_FILE_MB = 50;

export async function POST(req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const sector = getPortalSectorFromEmail((portal as any).email ?? "");
    if (!WRITE_SECTORS.has(sector)) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const sb = createSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });

    // ── Parse multipart ───────────────────────────────────────────────────────
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_FILE_MB) {
      return NextResponse.json(
        { error: `Arquivo muito grande (${sizeMB.toFixed(1)} MB). Máximo: ${MAX_FILE_MB} MB.` },
        { status: 413 }
      );
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    // ── Parse para array de linhas string[][] ─────────────────────────────────
    let rawRows: string[][];

    if (fileName.endsWith(".csv")) {
      rawRows = parseCSV(buffer.toString("utf-8"));
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      rawRows = await parseXLSX(buffer);
    } else {
      return NextResponse.json(
        { error: "Formato não suportado. Envie um arquivo .csv ou .xlsx." },
        { status: 415 }
      );
    }

    if (rawRows.length < 2) {
      return NextResponse.json({ error: "Arquivo vazio ou sem dados." }, { status: 422 });
    }

    // ── Log de início ─────────────────────────────────────────────────────────
    const { data: logRow } = await sb
      .from("portal_sheets_sync_log")
      .insert({
        started_at: new Date().toISOString(),
        status: "running",
        triggered_by: `upload:${(portal as any).email ?? "desconhecido"}`,
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

    // ── Detecta cabeçalho ─────────────────────────────────────────────────────
    const headerIdx = findHeaderRowIndex(rawRows);
    const headers = rawRows[headerIdx] ?? [];
    const colMap = buildColumnMap(headers);
    const dataRows = rawRows.slice(headerIdx + 1);

    if (colMap.cod === undefined && colMap.valor === undefined) {
      await updateLog("error", 0, 0, "Colunas obrigatórias não encontradas (Cód. / Valor).");
      return NextResponse.json(
        {
          error:
            "Não foi possível detectar as colunas. Certifique-se de usar a aba " +
            "'personalizadoFinanceiro (13)' exportada como CSV UTF-8.",
        },
        { status: 422 }
      );
    }

    // ── Transforma linhas ─────────────────────────────────────────────────────
    const now = new Date().toISOString();
    const col = (row: string[], idx: number | undefined): string =>
      idx !== undefined ? (row[idx] ?? "").trim() : "";

    const records = [];

    for (const row of dataRows) {
      const cod = col(row, colMap.cod);
      if (!cod || cod.toLowerCase().includes("total")) continue;

      const rawValor = col(row, colMap.valor);
      const valorRaw =
        parseFloat(
          rawValor.replace(/R\$\s?/, "").replace(/\./g, "").replace(",", ".")
        ) || 0;

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

    if (records.length === 0) {
      await updateLog("error", dataRows.length, 0, "Nenhum registro válido encontrado.");
      return NextResponse.json({ error: "Nenhum registro válido no arquivo." }, { status: 422 });
    }

    // ── Upsert em lotes ───────────────────────────────────────────────────────
    let totalUpserted = 0;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { error } = await sb
        .from("portal_lancamentos")
        .upsert(batch, { onConflict: "cod" });

      if (error) {
        await updateLog("error", dataRows.length, totalUpserted, error.message);
        return NextResponse.json(
          { error: `Erro no lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}` },
          { status: 500 }
        );
      }
      totalUpserted += batch.length;
    }

    await updateLog("success", dataRows.length, totalUpserted);

    return NextResponse.json({
      ok: true,
      rows_read: dataRows.length,
      rows_upserted: totalUpserted,
      columns_detected: Object.keys(colMap),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}

// ─── CSV parser (UTF-8, separador vírgula ou ponto-e-vírgula) ─────────────────

function parseCSV(text: string): string[][] {
  // Detecta separador (vírgula ou ponto-e-vírgula)
  const firstLine = text.split("\n")[0] ?? "";
  const sep = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";

  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;
    rows.push(splitCSVLine(line, sep));
  }
  return rows;
}

function splitCSVLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === sep && !inQuote) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ─── XLSX parser (usa biblioteca xlsx já instalada) ───────────────────────────

async function parseXLSX(buffer: Buffer): Promise<string[][]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });

  // Procura a aba na seguinte ordem de prioridade:
  // 1. Nome exato configurado em GOOGLE_SHEETS_SHEET_NAME
  // 2. Aba que contém "personalizadoFinanceiro" no nome
  // 3. Primeira aba disponível
  const configuredName = process.env.GOOGLE_SHEETS_SHEET_NAME ?? "personalizadoFinanceiro (13)";

  const targetSheet =
    workbook.SheetNames.find((n) => n === configuredName) ??
    workbook.SheetNames.find((n) =>
      n.toLowerCase().includes("personalizadofinanceiro") ||
      n.toLowerCase().includes("personalizado")
    ) ??
    workbook.SheetNames[0];

  if (!targetSheet) throw new Error("Nenhuma aba encontrada no arquivo.");

  const sheet = workbook.Sheets[targetSheet];
  const data = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as string[][];

  return data;
}
