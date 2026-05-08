export type ContratoStatus =
  | "demanda"
  | "em_elaboracao"
  | "gestao_assinaturas"
  | "ativo";

export type VencimentoTipo = "automatico" | "15_dias";

export type ProcessoTipo = "judicial" | "extrajudicial";

export type ProcessoFase = "inicial" | "andamento" | "julgado" | "finalizado";

export type NivelRisco = "baixo" | "medio" | "alto";

export type TrilhaStatus = "success" | "warning" | "critical";

export interface BapsContratoRow {
  id: string;
  fornecedor: string;
  status: ContratoStatus;
  data_inicio: string;
  emissao_nf: string | null;
  vencimento_tipo: VencimentoTipo;
  vencimento_data: string | null;
  responsavel: string;
  testemunha_andressa: boolean;
  testemunha_ana_paula: boolean;
  decisao_notas: string | null;
  destaque_risco: boolean;
}

export interface BapsProcessoRow {
  id: string;
  tipo: ProcessoTipo;
  parte_envolvida: string;
  numero: string;
  tribunal: string;
  fase: ProcessoFase;
  responsavel_escritorio: string;
  atualizacao_semanal: string;
  nivel_risco: NivelRisco;
}

export interface BapsCertidaoRow {
  id: string;
  nome: string;
  data_ultima_emissao: string;
  previsao_proxima: string;
  status_pendencia: string;
}

export interface BapsFinanceiroResumoRow {
  id: number;
  saldo_global: number;
  deficit_q1: number;
  contas_bancarias: string;
  pendencias: string;
  inadimplencia_patrocinadores: string;
  referencia_mes: string;
}

export interface BapsFinanceiroEventoRow {
  id: string;
  nome_evento: string;
  cidade: string;
  receitas: number;
  despesas_pagas: number;
  referencia: string;
}

export interface BapsAssociadosResumoRow {
  id: number;
  total_ativos: number;
  vencimentos_mes: number;
  saidas_mes: number;
  saidas_semana: number;
  saidas_ytd: number;
  notas_comercial: string;
}

export interface BapsInstitucionalRow {
  id: number;
  atas_procuracoes_ok: boolean;
  status_estatutario: string;
  proxima_assembleia: string | null;
  regimento_interno_ok: boolean;
}

export interface BapsEventoTrilhaRow {
  id: string;
  slug: string;
  nome: string;
  status: TrilhaStatus;
  detalhe: string;
  palestrantes: string;
  ordem: number;
}

export interface BapsNpsMetricaRow {
  id: string;
  categoria: string;
  ano: number;
  valor: number;
}

export interface BapsCongressoDisponibilidadeRow {
  id: number;
  referencia: string;
  congressistas_cp: number;
  residentes: number;
  gestores: number;
  pre_pos: number;
  videomakers: number;
  staffs: number;
  staffs_patrocinio: number;
  visitantes: number;
  lab_face: number;
  lab_corporal: number;
  baps_in_the_house: number;
  inscritos_total: number;
  congressistas_pagantes: number;
  congressistas_isentos: number;
  pal_face_isentos: number;
  pal_face_pagantes: number;
  pal_mama_isentos: number;
  pal_mama_pagantes: number;
  pal_corporal_isentos: number;
  pal_corporal_pagantes: number;
  pal_gestao_isentos: number;
  pal_gestao_pagantes: number;
  pal_prepos_isentos: number;
  pal_prepos_pagantes: number;
}

export interface BapsSnapshot {
  contratos: BapsContratoRow[];
  processos: BapsProcessoRow[];
  certidoes: BapsCertidaoRow[];
  financeiro_resumo: BapsFinanceiroResumoRow;
  financeiro_eventos: BapsFinanceiroEventoRow[];
  associados_resumo: BapsAssociadosResumoRow;
  institucional: BapsInstitucionalRow;
  evento_trilhas: BapsEventoTrilhaRow[];
  nps_metricas: BapsNpsMetricaRow[];
  congresso_disponibilidade: BapsCongressoDisponibilidadeRow;
}
