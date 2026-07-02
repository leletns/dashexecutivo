/**
 * POST /api/lancamentos/edit
 * DELETE /api/lancamentos/edit?cod=...
 *
 * Permite ao financeiro (e executivo) editar qualquer campo de um lançamento
 * existente (vindo da planilha) ou criar um lançamento 100% novo, direto pelo
 * painel — sem precisar abrir a planilha/e-Gestor.
 *
 * As edições/lançamentos manuais ficam em portal_lancamentos_overrides e são
 * mesclados com os dados da planilha em getLancamentos() (lib/lancamentos-sheet.ts):
 *  - cód. existente na planilha → edição é aplicada por cima (merge campo a campo)
 *  - cód. "MANUAL-..." (gerado aqui) → lançamento novo, exibido junto dos demais
 *  - { deleted: true } → esconde o lançamento (planilha ou manual) do painel
 *
 * Escrita restrita aos setores financeiro e executivo.
 */

import { NextResponse } from "next/server";
import { requirePortalSession } from "@/lib/auth-server";
import { getPortalSectorFromEmail } from "@/lib/portal-sector";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { logAudit, nomeAmigavel } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WRITE_SECTORS = new Set(["financeiro", "executivo"]);

const EDITABLE_FIELDS = [
  "descricao",
  "nome",
  "conta_caixa",
  "plano_contas",
  "plano_primario_contas",
  "classificacao",
  "sub_classificacao",
  "forma_pagamento",
  "situacao",
  "ent_saida",
  "rec_desp",
  "tratativa",
  "evento",
  "valor",
  "data_vencimento",
  "data_pagamento",
  "data_cred_deb",
] as const;

type Body = {
  cod?: string;
  manual?: boolean;
  fields: Partial<Record<(typeof EDITABLE_FIELDS)[number], unknown>>;
};

export async function POST(req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const sector = getPortalSectorFromEmail(portal.email);
    if (!WRITE_SECTORS.has(sector)) {
      return NextResponse.json({ error: "Sem permissão para edição." }, { status: 403 });
    }

    const sb = createSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });

    const body = (await req.json()) as Body;
    const manual = !!body.manual || !body.cod;
    const cod = body.cod?.trim() || `MANUAL-${Date.now()}`;

    const fields: Record<string, unknown> = {};
    for (const k of EDITABLE_FIELDS) {
      const v = body.fields?.[k];
      if (v === undefined) continue;
      fields[k] = v === "" ? null : v;
    }

    if (manual && !fields.descricao && !fields.nome) {
      return NextResponse.json({ error: "Informe ao menos a descrição ou o nome." }, { status: 400 });
    }
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: "Nenhum campo para salvar." }, { status: 400 });
    }

    const row = {
      cod,
      ...fields,
      manual,
      deleted: false,
      updated_at: new Date().toISOString(),
      updated_by: portal.email,
    };

    const { error } = await sb.from("portal_lancamentos_overrides").upsert(row, { onConflict: "cod" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const nome = nomeAmigavel(portal.email);
    const refLanc = (fields.descricao as string) || (fields.nome as string) || cod;
    await logAudit(sb, {
      userEmail: portal.email,
      userName: nome,
      sector,
      action: manual ? "criou" : "editou",
      entity: "lancamento",
      entityId: cod,
      summary: `${nome} ${manual ? "criou" : "editou"} o lançamento "${refLanc}"`,
      details: { campos: Object.keys(fields) },
    });

    return NextResponse.json({ ok: true, cod });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const sector = getPortalSectorFromEmail(portal.email);
    if (!WRITE_SECTORS.has(sector)) {
      return NextResponse.json({ error: "Sem permissão para edição." }, { status: 403 });
    }

    const sb = createSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: "Banco de dados não configurado." }, { status: 503 });

    const { searchParams } = new URL(req.url);
    const cod = searchParams.get("cod")?.trim();
    if (!cod) return NextResponse.json({ error: "Código obrigatório." }, { status: 400 });

    const { error } = await sb.from("portal_lancamentos_overrides").upsert(
      { cod, deleted: true, updated_at: new Date().toISOString(), updated_by: portal.email },
      { onConflict: "cod" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const nome = nomeAmigavel(portal.email);
    await logAudit(sb, {
      userEmail: portal.email,
      userName: nome,
      sector,
      action: "excluiu",
      entity: "lancamento",
      entityId: cod,
      summary: `${nome} excluiu o lançamento ${cod}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}
