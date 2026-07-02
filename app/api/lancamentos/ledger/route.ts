/**
 * GET /api/lancamentos/ledger
 *
 * Extrato completo dos lançamentos — réplica em tela da planilha e-Gestor,
 * com todas as colunas (conta, categoria, subcategoria, forma de pagamento,
 * evento, situação) e filtros para o usuário explorar qualquer movimentação
 * sem precisar abrir o e-Gestor ou a planilha.
 *
 * Mesma fonte de dados (planilha pública com fallback Supabase) e mesmo
 * cache de `lib/lancamentos-sheet.ts` usado por /api/lancamentos/fluxo.
 *
 * Query params:
 *   page, limit        — paginação (limit máx. 200)
 *   search             — busca em nome, descrição, evento, categoria, cód.
 *   ano                — filtra por ano em data_vencimento OU data_pagamento
 *   conta              — filtro exato por conta_caixa
 *   classificacao      — filtro exato por classificação
 *   sub_classificacao  — filtro exato por sub-classificação
 *   evento             — filtro exato por evento
 *   situacao           — filtro exato por situação
 *   rec_desp           — "Receitas" | "Despesas"
 */

import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/auth-server";
import { getLancamentos, type LancamentoRow } from "@/lib/lancamentos-sheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export async function GET(req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));

    const search = searchParams.get("search")?.trim() ?? "";
    const ano = searchParams.get("ano")?.trim() ?? "";
    const from = searchParams.get("from")?.trim() ?? "";
    const to = searchParams.get("to")?.trim() ?? "";
    const conta = searchParams.get("conta")?.trim() ?? "";
    const classificacao = searchParams.get("classificacao")?.trim() ?? "";
    const subClassificacao = searchParams.get("sub_classificacao")?.trim() ?? "";
    const evento = searchParams.get("evento")?.trim() ?? "";
    const situacao = searchParams.get("situacao")?.trim() ?? "";
    const recDesp = searchParams.get("rec_desp")?.trim() ?? "";

    const { rows, fonte, aviso } = await getLancamentos();

    // ── Opções de filtro (derivadas dos dados, sempre atualizadas) ───────────
    const contasSet = new Set<string>();
    const categoriasSet = new Set<string>();
    const subcategoriasSet = new Set<string>();
    const eventosSet = new Set<string>();
    const situacoesSet = new Set<string>();
    for (const r of rows) {
      if (r.conta_caixa) contasSet.add(r.conta_caixa);
      if (r.classificacao) categoriasSet.add(r.classificacao);
      if (r.sub_classificacao) subcategoriasSet.add(r.sub_classificacao);
      if (r.evento) eventosSet.add(r.evento);
      if (r.situacao) situacoesSet.add(r.situacao);
    }

    // ── Filtragem ──────────────────────────────────────────────────────────
    const searchNorm = search ? norm(search) : "";
    const filtered = rows.filter((r) => {
      // Intervalo (mês/bimestre/…) tem prioridade sobre o ano; casa por
      // vencimento OU pagamento dentro do período.
      if (from || to) {
        const dentro = (d: string | null | undefined) =>
          !!d && (!from || d >= from) && (!to || d <= to);
        if (!dentro(r.data_vencimento) && !dentro(r.data_pagamento)) return false;
      } else if (ano) {
        const okVenc = r.data_vencimento?.slice(0, 4) === ano;
        const okPag = r.data_pagamento?.slice(0, 4) === ano;
        if (!okVenc && !okPag) return false;
      }
      if (conta && r.conta_caixa !== conta) return false;
      if (classificacao && r.classificacao !== classificacao) return false;
      if (subClassificacao && r.sub_classificacao !== subClassificacao) return false;
      if (evento && r.evento !== evento) return false;
      if (situacao && r.situacao !== situacao) return false;
      if (recDesp && (r.rec_desp ?? "").toLowerCase() !== recDesp.toLowerCase()) return false;
      if (searchNorm) {
        const haystack = norm(
          [r.nome, r.descricao, r.evento, r.classificacao, r.sub_classificacao, r.cod]
            .filter(Boolean)
            .join(" ")
        );
        if (!haystack.includes(searchNorm)) return false;
      }
      return true;
    });

    // ── Ordenação: mais recente primeiro (vencimento, com fallback p/ pagamento) ─
    const sorted = [...filtered].sort((a, b) => {
      const da = a.data_vencimento ?? a.data_pagamento ?? "";
      const db = b.data_vencimento ?? b.data_pagamento ?? "";
      return db.localeCompare(da);
    });

    const total = sorted.length;
    const pages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const data = sorted.slice(offset, offset + limit);

    // ── Totais do conjunto filtrado ───────────────────────────────────────
    let somaReceitas = 0;
    let somaDespesas = 0;
    for (const r of filtered) {
      const rd = (r.rec_desp ?? "").toLowerCase().trim();
      if (rd === "receitas") somaReceitas += r.valor;
      else somaDespesas += r.valor;
    }

    return NextResponse.json({
      fonte,
      aviso,
      data,
      total,
      page,
      limit,
      pages,
      totais: { receitas: somaReceitas, despesas: somaDespesas },
      opcoes: {
        contas: [...contasSet].sort(),
        categorias: [...categoriasSet].sort(),
        sub_categorias: [...subcategoriasSet].sort(),
        eventos: [...eventosSet].sort(),
        situacoes: [...situacoesSet].sort(),
      },
    } satisfies {
      fonte: "planilha" | "supabase";
      aviso: string | null;
      data: LancamentoRow[];
      total: number;
      page: number;
      limit: number;
      pages: number;
      totais: { receitas: number; despesas: number };
      opcoes: {
        contas: string[];
        categorias: string[];
        sub_categorias: string[];
        eventos: string[];
        situacoes: string[];
      };
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}
