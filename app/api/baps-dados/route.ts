/**
 * GET /api/baps-dados
 *
 * Lê a tabela `baps_dashboard_dados` (Data Lake) e agrega os valores
 * financeiros do JSONB `dados` por aba_origem.
 *
 * Query params:
 *   aba   = filtro parcial em aba_origem (ex: "evento", "fluxo", "saldo")
 *   page  = número da página (default: 1)
 *   limit = registros por página (default: 100, max: 500)
 */

import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/auth-server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface BapsDashboardRow {
  id: number;
  aba_origem: string;
  dados: Record<string, any>;
  criado_em: string;
}

export interface BapsDadosAgregado {
  aba_origem: string;
  receitas: number;
  despesas: number;
  saldo: number;
  campos: string[];        // chaves encontradas no dados JSONB
  sample: Record<string, any>; // primeiro registro para inspeção
}

export interface BapsDadosResponse {
  totais: {
    receitas: number;
    despesas: number;
    saldo: number;
    resultado_projetado: number;
    a_receber: number;
    a_pagar: number;
  };
  por_aba: BapsDadosAgregado[];
  registros: BapsDashboardRow[];
  total: number;
  page: number;
  pages: number;
}

// ─── Mapeamento de campos JSONB ───────────────────────────────────────────────

const RECEITA_KEYS = [
  "receita", "receitas", "entrada", "entradas",
  "bilheteria", "patrocinio", "patrocínio",
  "faturamento", "arrecadacao", "arrecadação",
  "credito", "crédito",
];

const DESPESA_KEYS = [
  "despesa", "despesas", "saida", "saidas", "saída", "saídas",
  "custo", "custos", "gasto", "gastos",
  "debito", "débito", "pagamento",
];

const A_RECEBER_KEYS = ["a_receber", "a receber", "areceber", "previsto_entrada"];
const A_PAGAR_KEYS   = ["a_pagar", "a pagar", "apagar", "previsto_saida"];

function parseNum(v: any): number {
  if (v == null || v === "" || v === false) return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const s = String(v)
    .replace(/R\$\s?/g, "")
    .replace(/\./g, "")   // remove separador de milhar BR
    .replace(",", ".")     // decimal BR → ponto
    .replace(/[^\d.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function classifyKey(key: string): "receita" | "despesa" | "a_receber" | "a_pagar" | "ignore" {
  const k = key.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (A_RECEBER_KEYS.some((r) => k.includes(r))) return "a_receber";
  if (A_PAGAR_KEYS.some((r) => k.includes(r)))   return "a_pagar";
  if (RECEITA_KEYS.some((r) => k.includes(r)))   return "receita";
  if (DESPESA_KEYS.some((r) => k.includes(r)))   return "despesa";
  return "ignore";
}

function extractFinancials(dados: Record<string, any>) {
  let receitas = 0, despesas = 0, aReceber = 0, aPagar = 0;
  for (const [key, val] of Object.entries(dados ?? {})) {
    const tipo = classifyKey(key);
    const n = Math.abs(parseNum(val));
    if (tipo === "receita")   receitas  += n;
    if (tipo === "despesa")   despesas  += n;
    if (tipo === "a_receber") aReceber  += n;
    if (tipo === "a_pagar")   aPagar    += n;
  }
  return { receitas, despesas, aReceber, aPagar };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const sb = createSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });

    const { searchParams } = new URL(req.url);
    const aba   = searchParams.get("aba")?.trim() ?? "";
    const page  = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "100")));
    const offset = (page - 1) * limit;

    // ── Conta total de registros ────────────────────────────────────────────
    let countQ = sb
      .from("baps_dashboard_dados")
      .select("id", { count: "exact", head: true });
    if (aba) countQ = countQ.ilike("aba_origem", `%${aba}%`);
    const { count: total } = await countQ;

    // ── Busca registros paginados ───────────────────────────────────────────
    let dataQ = sb
      .from("baps_dashboard_dados")
      .select("id, aba_origem, dados, criado_em")
      .order("criado_em", { ascending: false })
      .range(offset, offset + limit - 1);
    if (aba) dataQ = dataQ.ilike("aba_origem", `%${aba}%`);

    const { data: rows, error } = await dataQ;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // ── Agrega KPIs por aba ─────────────────────────────────────────────────
    const abaMap = new Map<string, {
      receitas: number; despesas: number; aReceber: number; aPagar: number;
      campos: Set<string>; sample: Record<string, any> | null;
    }>();

    let totalReceitas = 0, totalDespesas = 0, totalAReceber = 0, totalAPagar = 0;

    for (const row of rows ?? []) {
      const dados = (row.dados ?? {}) as Record<string, any>;
      const origem = row.aba_origem ?? "sem_aba";
      const { receitas, despesas, aReceber, aPagar } = extractFinancials(dados);

      totalReceitas  += receitas;
      totalDespesas  += despesas;
      totalAReceber  += aReceber;
      totalAPagar    += aPagar;

      const cur = abaMap.get(origem) ?? {
        receitas: 0, despesas: 0, aReceber: 0, aPagar: 0,
        campos: new Set<string>(), sample: null,
      };
      cur.receitas  += receitas;
      cur.despesas  += despesas;
      cur.aReceber  += aReceber;
      cur.aPagar    += aPagar;
      Object.keys(dados).forEach((k) => cur.campos.add(k));
      if (!cur.sample) cur.sample = dados;
      abaMap.set(origem, cur);
    }

    const por_aba: BapsDadosAgregado[] = Array.from(abaMap.entries()).map(([aba_origem, v]) => ({
      aba_origem,
      receitas: v.receitas,
      despesas: v.despesas,
      saldo: v.receitas - v.despesas,
      campos: Array.from(v.campos),
      sample: v.sample ?? {},
    }));

    const totalCount = total ?? 0;

    return NextResponse.json({
      totais: {
        receitas: totalReceitas,
        despesas: totalDespesas,
        saldo: totalReceitas - totalDespesas,
        resultado_projetado: totalReceitas - totalDespesas + totalAReceber - totalAPagar,
        a_receber: totalAReceber,
        a_pagar: totalAPagar,
      },
      por_aba,
      registros: (rows ?? []) as BapsDashboardRow[],
      total: totalCount,
      page,
      pages: Math.ceil(totalCount / limit),
    } satisfies BapsDadosResponse);

  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}
