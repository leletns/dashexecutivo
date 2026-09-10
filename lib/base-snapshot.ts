/**
 * Retrato embutido da base viva do Dropbox (a planilha-mestre do Miguel).
 *
 * Por quê: a produção perdeu as variáveis do Vercel (Supabase + Dropbox), então
 * a sincronização não roda e o painel caía para uma planilha antiga do Google.
 * Aqui embutimos um retrato COMPACTO (gzip+base64) da base atual, para o painel
 * mostrar os números certos mesmo sem nenhuma configuração externa.
 *
 * Ordem de preferência em getLancamentos: Supabase (quando configurado e com
 * dados) → ESTE retrato → planilha Google (legado). Quando o Vercel voltar a
 * ter as chaves e a sincronização rodar, o Supabase (mais fresco) volta a
 * mandar sozinho.
 *
 * Para atualizar quando o Miguel mexer na base: regenerar lib/data/base-snapshot.*
 */

import { gunzipSync, strFromU8 } from "fflate";
import { SNAPSHOT_GZ_B64, SNAPSHOT_META } from "@/lib/data/base-snapshot.b64";
import type { LancamentoRow } from "@/lib/lancamentos-sheet";

export interface SnapshotMeta {
  gerado_em: string;
  relatorio_em: string | null;
  saldo_dia: number | null;
  saldo_projetado: number | null;
  total_registros: number;
  fonte: string;
}

let _cache: LancamentoRow[] | null = null;

export function getSnapshotMeta(): SnapshotMeta {
  return SNAPSHOT_META as unknown as SnapshotMeta;
}

/** Lê o retrato embutido → LancamentoRow[]. Descomprime uma vez e guarda em memória. */
export function getSnapshotLancamentos(): LancamentoRow[] {
  if (_cache) return _cache;
  try {
    const gz = Uint8Array.from(Buffer.from(SNAPSHOT_GZ_B64, "base64"));
    const json = strFromU8(gunzipSync(gz));
    const raw = JSON.parse(json) as Array<Record<string, unknown>>;
    _cache = raw.map((r) => ({
      cod: (r.cod as string) ?? null,
      descricao: (r.descricao as string) ?? null,
      nome: (r.nome_razao_social as string) ?? null,
      conta_caixa: (r.conta_caixa as string) ?? null,
      plano_contas: (r.plano_contas as string) ?? null,
      plano_primario_contas: (r.plano_primario_contas as string) ?? null,
      classificacao: (r.classificacao as string) ?? null,
      sub_classificacao: (r.sub_classificacao as string) ?? null,
      forma_pagamento: null,
      situacao: (r.situacao as string) ?? null,
      ent_saida: null,
      rec_desp: (r.rec_desp as string) ?? null,
      tratativa: (r.tratativa as string) ?? null,
      evento: (r.evento as string) ?? null,
      valor: Number(r.valor) || 0,
      data_vencimento: (r.data_vencimento as string) ?? null,
      data_pagamento: (r.data_pagamento as string) ?? null,
      data_cred_deb: null,
    })) as LancamentoRow[];
  } catch {
    _cache = [];
  }
  return _cache;
}
