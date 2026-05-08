import { BAPS_DEFAULT_SNAPSHOT } from "./defaults";
import type { BapsSnapshot } from "./types";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function loadBapsSnapshot(): Promise<BapsSnapshot> {
  const admin = createSupabaseAdmin();
  const base = JSON.parse(JSON.stringify(BAPS_DEFAULT_SNAPSHOT)) as BapsSnapshot;

  if (!admin) return base;

  try {
    const [
      contratos,
      processos,
      certidoes,
      finRes,
      finEv,
      assoc,
      inst,
      trilhas,
      nps,
    ] = await Promise.all([
      admin.from("baps_contratos").select("*"),
      admin.from("baps_processos").select("*"),
      admin.from("baps_certidoes").select("*"),
      admin.from("baps_financeiro_resumo").select("*").eq("id", 1).maybeSingle(),
      admin.from("baps_financeiro_eventos").select("*"),
      admin.from("baps_associados_resumo").select("*").eq("id", 1).maybeSingle(),
      admin.from("baps_institucional").select("*").eq("id", 1).maybeSingle(),
      admin.from("baps_evento_trilhas").select("*").order("ordem"),
      admin.from("baps_nps_metricas").select("*"),
    ]);

    const out: BapsSnapshot = base;

    if (contratos.data?.length) {
      out.contratos = contratos.data.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        fornecedor: String(r.fornecedor ?? ""),
        status: r.status as BapsSnapshot["contratos"][0]["status"],
        data_inicio: String(r.data_inicio ?? "").slice(0, 10),
        emissao_nf: r.emissao_nf ? String(r.emissao_nf).slice(0, 10) : null,
        vencimento_tipo: r.vencimento_tipo as BapsSnapshot["contratos"][0]["vencimento_tipo"],
        vencimento_data: r.vencimento_data
          ? String(r.vencimento_data).slice(0, 10)
          : null,
        responsavel: String(r.responsavel ?? ""),
        testemunha_andressa: !!r.testemunha_andressa,
        testemunha_ana_paula: !!r.testemunha_ana_paula,
        decisao_notas: r.decisao_notas ? String(r.decisao_notas) : null,
        destaque_risco: !!r.destaque_risco,
      }));
    }

    if (processos.data?.length) {
      out.processos = processos.data.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        tipo: r.tipo as BapsSnapshot["processos"][0]["tipo"],
        parte_envolvida: String(r.parte_envolvida ?? ""),
        numero: String(r.numero ?? ""),
        tribunal: String(r.tribunal ?? ""),
        fase: r.fase as BapsSnapshot["processos"][0]["fase"],
        responsavel_escritorio: String(r.responsavel_escritorio ?? ""),
        atualizacao_semanal: String(r.atualizacao_semanal ?? ""),
        nivel_risco: r.nivel_risco as BapsSnapshot["processos"][0]["nivel_risco"],
      }));
    }

    if (certidoes.data?.length) {
      out.certidoes = certidoes.data.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        nome: String(r.nome ?? ""),
        data_ultima_emissao: String(r.data_ultima_emissao ?? "").slice(0, 10),
        previsao_proxima: String(r.previsao_proxima ?? "").slice(0, 10),
        status_pendencia: String(r.status_pendencia ?? ""),
      }));
    }

    const fr = finRes.data as Record<string, unknown> | null;
    if (fr) {
      out.financeiro_resumo = {
        id: 1,
        saldo_global: num(fr.saldo_global, base.financeiro_resumo.saldo_global),
        deficit_q1: num(fr.deficit_q1, base.financeiro_resumo.deficit_q1),
        contas_bancarias: String(fr.contas_bancarias ?? base.financeiro_resumo.contas_bancarias),
        pendencias: String(fr.pendencias ?? base.financeiro_resumo.pendencias),
        inadimplencia_patrocinadores: String(
          fr.inadimplencia_patrocinadores ??
            base.financeiro_resumo.inadimplencia_patrocinadores,
        ),
        referencia_mes: String(fr.referencia_mes ?? base.financeiro_resumo.referencia_mes),
      };
    }

    if (finEv.data?.length) {
      out.financeiro_eventos = finEv.data.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        nome_evento: String(r.nome_evento ?? ""),
        cidade: String(r.cidade ?? ""),
        receitas: num(r.receitas, 0),
        despesas_pagas: num(r.despesas_pagas, 0),
        referencia: String(r.referencia ?? ""),
      }));
    }

    const ar = assoc.data as Record<string, unknown> | null;
    if (ar) {
      out.associados_resumo = {
        id: 1,
        total_ativos: num(ar.total_ativos, base.associados_resumo.total_ativos),
        vencimentos_mes: num(ar.vencimentos_mes, base.associados_resumo.vencimentos_mes),
        saidas_mes: num(ar.saidas_mes, base.associados_resumo.saidas_mes),
        saidas_semana: num(ar.saidas_semana, base.associados_resumo.saidas_semana),
        saidas_ytd: num(ar.saidas_ytd, base.associados_resumo.saidas_ytd),
        notas_comercial: String(ar.notas_comercial ?? base.associados_resumo.notas_comercial),
      };
    }

    const ir = inst.data as Record<string, unknown> | null;
    if (ir) {
      out.institucional = {
        id: 1,
        atas_procuracoes_ok: !!ir.atas_procuracoes_ok,
        status_estatutario: String(ir.status_estatutario ?? ""),
        proxima_assembleia: ir.proxima_assembleia
          ? String(ir.proxima_assembleia).slice(0, 10)
          : null,
        regimento_interno_ok: !!ir.regimento_interno_ok,
      };
    }

    if (trilhas.data?.length) {
      out.evento_trilhas = trilhas.data.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        slug: String(r.slug ?? ""),
        nome: String(r.nome ?? ""),
        status: r.status as BapsSnapshot["evento_trilhas"][0]["status"],
        detalhe: String(r.detalhe ?? ""),
        palestrantes: String(r.palestrantes ?? ""),
        ordem: num(r.ordem, 0),
      }));
    }

    if (nps.data?.length) {
      out.nps_metricas = nps.data.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        categoria: String(r.categoria ?? ""),
        ano: num(r.ano, new Date().getFullYear()),
        valor: num(r.valor, 0),
      }));
    }

    return out;
  } catch {
    return base;
  }
}
