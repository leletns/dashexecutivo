export interface ContaBancaria {
  id: string;
  nome: string;
  tipo: "corrente" | "poupanca" | "investimento" | "outros";
  banco: string;
  saldo: number;
  data_saldo: string; // ISO date yyyy-mm-dd
  updated_at?: string;
}

export interface PrevisaoMensal {
  id: string;
  referencia_mes: string; // yyyy-mm
  total_despesas_previstas: number;
  total_entradas_previstas: number;
  notas: string;
  updated_at?: string;
}

export interface EventoResultado {
  id: string;
  nome_evento: string;
  referencia_mes: string;
  receita_bilheteria: number;
  receita_patrocinio: number;
  receita_outros: number;
  despesas_total: number;
  updated_at?: string;
}

export interface AssociadoHistorico {
  id: string;
  periodo_label: string; // e.g. "ago/2022"
  ano: number;
  mes: number;
  total_ativos: number;
}

export interface AssociadoMensal {
  id: string;
  ano: number;
  mes: number;
  total_inicio_mes: number;
  previsao_renovacoes: number;
  renovacoes_realizadas: number;
  novas_adesoes: number;
  saidas: number;
  updated_at?: string;
}

export interface CustoDepartamento {
  id: string;
  departamento: string;
  referencia_mes: string;
  valor_mensal: number;
  notas: string;
  updated_at?: string;
}

export interface PortalFinanceiroSnapshot {
  contas_bancarias: ContaBancaria[];
  previsao_mensal: PrevisaoMensal | null;
  eventos_resultado: EventoResultado[];
  associados_historico: AssociadoHistorico[];
  associados_mensal: AssociadoMensal[];
  custos_departamento: CustoDepartamento[];
}

export const DEPARTAMENTOS = [
  "Institucional",
  "Marketing",
  "Comercial",
  "Administrativo",
  "Financeiro / Contábil",
  "TI",
  "Segurança",
  "Jurídico",
  "Ouvidoria",
  "Assessoria Executiva",
  "Tesouraria",
  "Presidência",
] as const;

export type Departamento = (typeof DEPARTAMENTOS)[number];

export const TIPO_CONTA_LABEL: Record<ContaBancaria["tipo"], string> = {
  corrente: "Corrente",
  poupanca: "Poupança",
  investimento: "Investimento",
  outros: "Outros",
};

export const PERIODO_HISTORICO: Array<{ label: string; ano: number; mes: number }> = [
  { label: "ago/2022", ano: 2022, mes: 8 },
  { label: "ago/2023", ano: 2023, mes: 8 },
  { label: "ago/2024", ano: 2024, mes: 8 },
  { label: "ago/2025", ano: 2025, mes: 8 },
];

export const MESES_2026 = [
  { mes: 1, label: "Janeiro" },
  { mes: 2, label: "Fevereiro" },
  { mes: 3, label: "Março" },
  { mes: 4, label: "Abril" },
  { mes: 5, label: "Maio" },
  { mes: 6, label: "Junho" },
  { mes: 7, label: "Julho" },
  { mes: 8, label: "Agosto" },
  { mes: 9, label: "Setembro" },
  { mes: 10, label: "Outubro" },
  { mes: 11, label: "Novembro" },
  { mes: 12, label: "Dezembro" },
] as const;

export const EMPTY_SNAPSHOT: PortalFinanceiroSnapshot = {
  contas_bancarias: [],
  previsao_mensal: null,
  eventos_resultado: [],
  associados_historico: [],
  associados_mensal: [],
  custos_departamento: [],
};
