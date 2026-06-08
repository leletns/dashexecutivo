/**
 * GET /api/lancamentos/fluxo
 *
 * Fonte de dados: lê DIRETO da planilha Google Sheets (aba e-Gestor) — sem
 * Google Cloud, sem conta de serviço. Basta a planilha estar publicada/
 * compartilhada como "Qualquer pessoa com o link pode ver"; o servidor busca
 * o export CSV público (GOOGLE_SHEETS_SPREADSHEET_ID + GOOGLE_SHEETS_SHEET_NAME).
 * Assim o painel mostra exatamente o que está na planilha — sem depender do
 * pipeline de sincronização (Apps Script → Supabase), que é a causa dos
 * números que não batiam.
 *
 * Fallback automático: se a planilha não estiver configurada/pública (ou a
 * leitura falhar), usa portal_lancamentos no Supabase — que continua
 * recebendo backup via Apps Script.
 *
 * Cache em memória de 45s para não sobrecarregar o Google Sheets a cada refresh.
 *
 * Agrega em:
 *  - fluxo_mensal: entradas/saídas/saldo/acumulado por mês (data_pagamento)
 *  - por_evento: receita/despesa/resultado por nome do evento
 *  - totais: receitas/despesas pagas, a receber/a pagar, saldo e resultado projetado
 */

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requirePortalSession } from "@/lib/auth-server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { todayBrasilia } from "@/lib/timezone";
import { findHeaderRowIndex, buildColumnMap, parseDateBR, parseMoneyBR } from "@/lib/google-sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const CACHE_TTL_MS = 45_000;

type Lancamento = {
  rec_desp: string | null;
  situacao: string | null;
  valor: number;
  data_pagamento: string | null;
  data_vencimento: string | null;
  evento: string | null;
};

let sheetCache: { at: number; rows: Lancamento[] } | null = null;

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

/** Lê e normaliza a planilha — retorna null se não estiver configurada. */
async function getLancamentosFromSheet(): Promise<Lancamento[] | null> {
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

  const rows: Lancamento[] = [];
  for (const row of dataRows) {
    const cod = col(row, colMap.cod);
    if (!cod || cod.toLowerCase().includes("total")) continue;

    const rawValor = col(row, colMap.valor);
    const valorRaw = parseMoneyBR(rawValor);

    const recDespCol = col(row, colMap.rec_desp);
    const recDesp =
      recDespCol || (valorRaw < 0 ? "Despesas" : valorRaw > 0 ? "Receitas" : null);

    rows.push({
      rec_desp:        recDesp,
      situacao:        col(row, colMap.situacao) || null,
      valor:           Math.abs(valorRaw),
      data_pagamento:  parseDateBR(col(row, colMap.data_pagamento)),
      data_vencimento: parseDateBR(col(row, colMap.data_vencimento)),
      evento:          col(row, colMap.evento) || null,
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
async function getLancamentosFromSupabase(
  sb: NonNullable<ReturnType<typeof createSupabaseAdmin>>
): Promise<Lancamento[]> {
  const { data } = await sb
    .from("portal_lancamentos")
    .select("rec_desp, situacao, valor, data_pagamento, data_vencimento, evento");
  return (data ?? []) as Lancamento[];
}

export async function GET(req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const ano = searchParams.get("ano")?.trim() ?? "";
    const today = todayBrasilia();

    let lancamentos: Lancamento[] | null = null;
    let fonte: "planilha" | "supabase" = "supabase";
    let avisoFonte: string | null = null;

    try {
      lancamentos = await getLancamentosFromSheet();
      if (lancamentos) fonte = "planilha";
    } catch (sheetErr: any) {
      lancamentos = null; // erro ao ler a planilha → cai para o backup no Supabase
      avisoFonte = `A planilha não pôde ser usada agora: ${sheetErr?.message ?? "erro desconhecido"} — mostrando os últimos dados salvos.`;
    }

    if (!lancamentos) {
      const sb = createSupabaseAdmin();
      if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });
      lancamentos = await getLancamentosFromSupabase(sb);
      if (lancamentos.length === 0) {
        avisoFonte = (avisoFonte ? avisoFonte + " " : "") +
          "Os dados salvos também estão vazios — é necessário rodar a sincronização ao menos uma vez.";
      }
    }

    // ── 1. Fluxo mensal (lançamentos realizados, com data_pagamento) ──────────
    let totalEntradas = 0;
    let totalSaidas = 0;
    const fluxoMap = new Map<string, { entradas: number; saidas: number }>();

    for (const row of lancamentos) {
      const sit = (row.situacao ?? "").toLowerCase().trim();
      if (sit !== "recebido" && sit !== "pago") continue;
      if (!row.data_pagamento || row.data_pagamento > today) continue;
      if (ano && row.data_pagamento.slice(0, 4) !== ano) continue;

      const rd  = (row.rec_desp ?? "").toLowerCase().trim();
      const val = Number(row.valor) || 0;
      const key = row.data_pagamento.slice(0, 7);
      const cur = fluxoMap.get(key) ?? { entradas: 0, saidas: 0 };

      if (rd === "receitas") {
        cur.entradas += val;
        totalEntradas += val;
      } else {
        cur.saidas += val;
        totalSaidas += val;
      }
      fluxoMap.set(key, cur);
    }

    let acumulado = 0;
    const fluxo_mensal = Array.from(fluxoMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, { entradas, saidas }]) => {
        const saldo = entradas - saidas;
        acumulado += saldo;
        const [anoK, mesNum] = key.split("-");
        const label = `${MESES_PT[Number(mesNum) - 1] ?? mesNum}/${(anoK ?? "").slice(2)}`;
        return { mes: label, chave: key, entradas, saidas, saldo, acumulado };
      });

    // ── 2. Lançamentos pendentes (A receber / A pagar) ────────────────────────
    let aReceber = 0;
    let aPagar   = 0;
    for (const row of lancamentos) {
      if (ano && (!row.data_vencimento || row.data_vencimento.slice(0, 4) !== ano)) continue;

      const sit = (row.situacao ?? "").toLowerCase().trim();
      const val = Number(row.valor) || 0;
      if (sit === "a receber") aReceber += val;
      else if (sit === "a pagar") aPagar += val;
    }

    // ── 3. Por evento ─────────────────────────────────────────────────────────
    const eventoMap = new Map<string, { receita: number; despesa: number }>();
    for (const row of lancamentos) {
      if (!row.evento) continue;
      if (ano && (!row.data_vencimento || row.data_vencimento.slice(0, 4) !== ano)) continue;

      const cur = eventoMap.get(row.evento) ?? { receita: 0, despesa: 0 };
      const rd  = (row.rec_desp ?? "").toLowerCase().trim();
      if (rd === "receitas") cur.receita += Number(row.valor) || 0;
      else cur.despesa += Number(row.valor) || 0;
      eventoMap.set(row.evento, cur);
    }

    const por_evento = Array.from(eventoMap.entries())
      .map(([nome, { receita, despesa }]) => ({
        nome,
        Receita: receita,
        Despesa: despesa,
        resultado: receita - despesa,
      }))
      .sort((a, b) => b.Receita - a.Receita)
      .slice(0, 12);

    // ── Diagnóstico: dados existem mas tudo deu zero (provável filtro/ano sem match) ─
    if (
      !avisoFonte &&
      lancamentos.length > 0 &&
      totalEntradas === 0 && totalSaidas === 0 && aReceber === 0 && aPagar === 0
    ) {
      // Conta quantos lançamentos realmente caem no ano filtrado (por data de
      // pagamento OU vencimento) — sem isso a mensagem podia dizer "nenhum
      // corresponde ao ano X" mesmo quando existem lançamentos daquele ano que
      // só não bateram com os outros filtros (situação/data já efetivada).
      const noAno = ano
        ? lancamentos.filter(
            (r) =>
              r.data_pagamento?.slice(0, 4) === ano ||
              r.data_vencimento?.slice(0, 4) === ano
          ).length
        : lancamentos.length;

      if (ano && noAno === 0) {
        avisoFonte = `Existem ${lancamentos.length.toLocaleString("pt-BR")} lançamentos na fonte de dados, mas nenhum corresponde ao ano ${ano}. Tente "Todos" para ver o período completo.`;
      } else if (ano) {
        avisoFonte = `Existem ${noAno.toLocaleString("pt-BR")} lançamentos do ano ${ano} na fonte de dados, mas nenhum tem situação "Recebido/Pago" com data de pagamento já efetivada (até ${today}) nem "A receber/A pagar" com vencimento em ${ano} — por isso os totais aparecem zerados.`;
      } else {
        avisoFonte = `Existem ${lancamentos.length.toLocaleString("pt-BR")} lançamentos na fonte de dados, mas nenhum tem situação "Recebido/Pago" com data de pagamento já efetivada — por isso os totais aparecem zerados.`;
      }
    }

    return NextResponse.json({
      fonte,
      aviso: avisoFonte,
      fluxo_mensal,
      por_evento,
      totais: {
        total_receitas_pagas: totalEntradas,
        total_despesas_pagas: totalSaidas,
        saldo_realizado:      totalEntradas - totalSaidas,
        resultado_projetado:  totalEntradas - totalSaidas + aReceber - aPagar,
        total_a_receber:      aReceber,
        total_a_pagar:        aPagar,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}
