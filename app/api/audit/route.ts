/**
 * GET /api/audit — histórico de alterações (aba de Notificações).
 *
 * Retorna as últimas alterações feitas pelos usuários (edições de lançamentos
 * e dados do painel). Visível a qualquer usuário autenticado do portal.
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

    const limit = Math.min(
      200,
      Math.max(1, parseInt(new URL(req.url).searchParams.get("limit") ?? "80", 10)),
    );

    const { data, error } = await sb
      .from("portal_audit_log")
      .select("id, created_at, user_name, user_email, sector, action, entity, entity_id, summary")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ eventos: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno." }, { status: 500 });
  }
}
