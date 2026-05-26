/**
 * GET /api/lancamentos
 *
 * Consulta paginada dos lançamentos sincronizados do e-Gestor.
 *
 * Query params:
 *   page      — número da página (default 1)
 *   limit     — registros por página (default 50, max 200)
 *   search    — busca em nome_razao_social, evento, classificacao
 *   evento    — filtro exato por evento
 *   situacao  — filtro exato por situação
 *   rec_desp  — "Receitas" | "Despesas"
 *   mes       — yyyy-mm (filtra por data_competencia)
 *   conta     — filtro por conta_caixa
 */

import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/auth-server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const sb = createSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
    const offset = (page - 1) * limit;

    const search = searchParams.get("search")?.trim() ?? "";
    const evento = searchParams.get("evento")?.trim() ?? "";
    const situacao = searchParams.get("situacao")?.trim() ?? "";
    const recDesp = searchParams.get("rec_desp")?.trim() ?? "";
    const mes = searchParams.get("mes")?.trim() ?? "";
    const conta = searchParams.get("conta")?.trim() ?? "";

    // ── Query base ────────────────────────────────────────────────────────────
    let query = sb
      .from("portal_lancamentos")
      .select(
        "id, cod, data_competencia, data_pagamento, data_vencimento, " +
          "nome_razao_social, evento, plano_primario_contas, classificacao, " +
          "sub_classificacao, rec_desp, ent_saida, situacao, valor, conta_caixa",
        { count: "exact" }
      );

    if (search) {
      query = query.or(
        `nome_razao_social.ilike.%${search}%,evento.ilike.%${search}%,classificacao.ilike.%${search}%,plano_primario_contas.ilike.%${search}%`
      );
    }
    if (evento) query = query.eq("evento", evento);
    if (situacao) query = query.eq("situacao", situacao);
    if (recDesp) query = query.eq("rec_desp", recDesp);
    if (conta) query = query.eq("conta_caixa", conta);
    if (mes) {
      const start = `${mes}-01`;
      const end = `${mes}-31`;
      query = query.gte("data_competencia", start).lte("data_competencia", end);
    }

    const { data, count, error } = await query
      .order("data_competencia", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      data: data ?? [],
      total: count ?? 0,
      page,
      limit,
      pages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}
