import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/auth-server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  EMPTY_SNAPSHOT,
  type PortalFinanceiroSnapshot,
} from "@/lib/portal-financeiro/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── GET /api/portal/financeiro?mes=yyyy-mm ──────────────────────────────────

export async function GET(req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const mes = searchParams.get("mes") ?? "";

    const sb = createSupabaseAdmin();
    if (!sb) return NextResponse.json(EMPTY_SNAPSHOT);

    const [contas, previsoes, eventos, assocHist, assocMes, custos] = await Promise.all([
      sb.from("portal_contas_bancarias").select("*").order("tipo").order("nome"),
      mes
        ? sb.from("portal_previsao_mensal").select("*").eq("referencia_mes", mes).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      mes
        ? sb.from("portal_evento_resultado").select("*").eq("referencia_mes", mes).order("nome_evento")
        : sb.from("portal_evento_resultado").select("*").order("referencia_mes", { ascending: false }).order("nome_evento"),
      sb.from("portal_associados_historico").select("*").order("ano").order("mes"),
      sb.from("portal_associados_mensal").select("*").order("ano").order("mes"),
      mes
        ? sb.from("portal_custos_departamento").select("*").eq("referencia_mes", mes).order("departamento")
        : sb.from("portal_custos_departamento").select("*").order("referencia_mes", { ascending: false }).order("departamento"),
    ]);

    const snapshot: PortalFinanceiroSnapshot = {
      contas_bancarias: contas.data ?? [],
      previsao_mensal: (previsoes as any).data ?? null,
      eventos_resultado: eventos.data ?? [],
      associados_historico: assocHist.data ?? [],
      associados_mensal: assocMes.data ?? [],
      custos_departamento: custos.data ?? [],
    };

    return NextResponse.json(snapshot);
  } catch {
    return NextResponse.json(EMPTY_SNAPSHOT);
  }
}

// ─── POST /api/portal/financeiro ─────────────────────────────────────────────
// Body: { table, action: "upsert"|"delete", payload }
// Escrita restrita a setores financeiro e executivo.

type MutateBody = {
  table:
    | "portal_contas_bancarias"
    | "portal_previsao_mensal"
    | "portal_evento_resultado"
    | "portal_associados_historico"
    | "portal_associados_mensal"
    | "portal_custos_departamento";
  action: "upsert" | "delete";
  payload: Record<string, unknown>;
};

const ALLOWED_TABLES = new Set([
  "portal_contas_bancarias",
  "portal_previsao_mensal",
  "portal_evento_resultado",
  "portal_associados_historico",
  "portal_associados_mensal",
  "portal_custos_departamento",
]);

const WRITE_SECTORS = new Set(["financeiro", "executivo"]);

export async function POST(req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const sector = (portal as any).sector ?? "";
    if (!WRITE_SECTORS.has(sector)) {
      return NextResponse.json({ error: "Sem permissão para edição." }, { status: 403 });
    }

    const body = (await req.json()) as MutateBody;
    if (!ALLOWED_TABLES.has(body.table)) {
      return NextResponse.json({ error: "Tabela inválida." }, { status: 400 });
    }

    const sb = createSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });

    if (body.action === "upsert") {
      const onConflict =
        body.table === "portal_previsao_mensal"
          ? "referencia_mes"
          : body.table === "portal_associados_mensal"
            ? "ano,mes"
            : body.table === "portal_custos_departamento"
              ? "departamento,referencia_mes"
              : body.table === "portal_associados_historico"
                ? "periodo_label"
                : undefined;

      const { data, error } = onConflict
        ? await sb.from(body.table).upsert(body.payload, { onConflict }).select().single()
        : await sb.from(body.table).upsert(body.payload).select().single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, data });
    }

    if (body.action === "delete") {
      const id = body.payload?.id as string | undefined;
      if (!id) return NextResponse.json({ error: "ID obrigatório para delete." }, { status: 400 });
      const { error } = await sb.from(body.table).delete().eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}
