/**
 * POST /api/sync/batch
 *
 * Recebe lotes de linhas já parseadas pelo cliente (string[][])
 * e faz upsert no Supabase. Evita o limite de 4.5MB do Vercel
 * ao processar o arquivo CSV no browser e enviar em chunks de ~500 linhas.
 *
 * Body: { rows: string[][], headers: string[], is_first_batch: boolean, log_id?: string }
 */

import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/auth-server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getPortalSectorFromEmail } from "@/lib/portal-sector";
import {
  findHeaderRowIndex,
  buildColumnMap,
  parseDateBR,
  parseMoneyBR,
} from "@/lib/google-sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WRITE_SECTORS = new Set(["financeiro", "executivo"]);

export async function POST(req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const sector = getPortalSectorFromEmail((portal as any).email ?? "");
    if (!WRITE_SECTORS.has(sector)) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const sb = createSupabaseAdmin();
    if (!sb) return NextResponse.json({
      error: "Banco de dados não configurado. Verifique as variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel."
    }, { status: 503 });

    const body = await req.json() as {
      headers: string[];       // linha do cabeçalho (já detectada no cliente)
      rows: string[][];        // linhas de dados deste lote
      is_first_batch: boolean; // true = criar log novo
      log_id?: string;         // id do log para atualizar nos lotes seguintes
      is_last_batch?: boolean; // true = finalizar log
      total_rows?: number;     // total de linhas para o log final
    };

    const { headers, rows, is_first_batch, log_id, is_last_batch, total_rows } = body;

    // ── Cria ou recupera log ──────────────────────────────────────────────────
    let activeLogId = log_id;

    if (is_first_batch) {
      const { data: logRow } = await sb
        .from("portal_sheets_sync_log")
        .insert({
          started_at: new Date().toISOString(),
          status: "running",
          triggered_by: `upload:${(portal as any).email ?? "desconhecido"}`,
        })
        .select("id")
        .single();
      activeLogId = logRow?.id as string | undefined;
    }

    // ── Mapeia colunas (usando os headers enviados pelo cliente) ──────────────
    // findHeaderRowIndex espera string[][], então empacotamos
    const colMap = buildColumnMap(headers);

    // ── Transforma linhas ─────────────────────────────────────────────────────
    const now = new Date().toISOString();
    const col = (row: string[], idx: number | undefined): string =>
      idx !== undefined ? (row[idx] ?? "").trim() : "";

    const records = [];

    for (const row of rows) {
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

    // ── Upsert ────────────────────────────────────────────────────────────────
    if (records.length > 0) {
      const { error } = await sb
        .from("portal_lancamentos")
        .upsert(records, { onConflict: "cod" });

      if (error) {
        const msg = error.code === "42P01"
          ? "Tabela portal_lancamentos não existe. Execute o arquivo supabase/schema.sql no banco de dados."
          : error.message;
        if (activeLogId) {
          await sb.from("portal_sheets_sync_log").update({
            finished_at: new Date().toISOString(),
            status: "error",
            error_message: msg,
          }).eq("id", activeLogId);
        }
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    // ── Finaliza log no último lote ───────────────────────────────────────────
    if (is_last_batch && activeLogId) {
      await sb.from("portal_sheets_sync_log").update({
        finished_at: new Date().toISOString(),
        status: "success",
        rows_read: total_rows ?? rows.length,
        rows_upserted: total_rows ?? rows.length,
      }).eq("id", activeLogId);
    }

    return NextResponse.json({
      ok: true,
      upserted: records.length,
      log_id: activeLogId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}
