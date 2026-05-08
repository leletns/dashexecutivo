import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/auth-server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Body =
  | { kind: "contrato"; data: Record<string, unknown> }
  | { kind: "processo"; data: Record<string, unknown> }
  | { kind: "certidao"; data: Record<string, unknown> }
  | { kind: "financeiro_resumo"; data: Record<string, unknown> }
  | { kind: "financeiro_evento"; data: Record<string, unknown> }
  /** Atualiza linha existente pelo nome do evento ou insere nova. */
  | { kind: "financeiro_evento_save"; data: Record<string, unknown> }
  | { kind: "associados_resumo"; data: Record<string, unknown> }
  | { kind: "institucional"; data: Record<string, unknown> };

export async function POST(req: Request) {
  const session = await getPortalSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const stripId = (row: Record<string, unknown>) => {
    const { id: _i, ...rest } = row;
    return rest;
  };

  try {
    switch (body.kind) {
      case "contrato": {
        const row = stripId(body.data);
        const { error } = await admin.from("baps_contratos").insert(row);
        if (error) throw error;
        break;
      }
      case "processo": {
        const row = stripId(body.data);
        const { error } = await admin.from("baps_processos").insert(row);
        if (error) throw error;
        break;
      }
      case "certidao": {
        const row = stripId(body.data);
        const { error } = await admin.from("baps_certidoes").insert(row);
        if (error) throw error;
        break;
      }
      case "financeiro_resumo": {
        const row = { ...stripId(body.data), id: 1 };
        const { error } = await admin
          .from("baps_financeiro_resumo")
          .upsert(row, { onConflict: "id" });
        if (error) throw error;
        break;
      }
      case "financeiro_evento": {
        const row = stripId(body.data);
        const { error } = await admin.from("baps_financeiro_eventos").insert(row);
        if (error) throw error;
        break;
      }
      case "financeiro_evento_save": {
        const nome = String(body.data.nome_evento ?? "").trim();
        if (!nome) throw new Error("Nome do evento é obrigatório.");
        const row = stripId(body.data) as Record<string, unknown>;
        const { data: existing, error: selErr } = await admin
          .from("baps_financeiro_eventos")
          .select("id")
          .eq("nome_evento", nome)
          .maybeSingle();
        if (selErr) throw selErr;
        if (existing?.id) {
          const { error } = await admin.from("baps_financeiro_eventos").update(row).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await admin.from("baps_financeiro_eventos").insert(row);
          if (error) throw error;
        }
        break;
      }
      case "associados_resumo": {
        const row = { ...stripId(body.data), id: 1 };
        const { error } = await admin
          .from("baps_associados_resumo")
          .upsert(row, { onConflict: "id" });
        if (error) throw error;
        break;
      }
      case "institucional": {
        const row = { ...stripId(body.data), id: 1 };
        const { error } = await admin
          .from("baps_institucional")
          .upsert(row, { onConflict: "id" });
        if (error) throw error;
        break;
      }
      default:
        return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Falha ao gravar";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
