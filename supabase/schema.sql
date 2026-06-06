-- Dash executivo · Supabase schema
-- Execute no SQL Editor do projeto Supabase. Configure env:
-- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (cliente),
-- SUPABASE_SERVICE_ROLE_KEY (apenas servidor, rotas /api/baps/*).

-- Extensões (uuid)
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Contratos (governança; ao status "ativo" deixa de constar em Demandas na UI)
-- ---------------------------------------------------------------------------
create table if not exists public.baps_contratos (
  id uuid primary key default gen_random_uuid(),
  fornecedor text not null,
  status text not null check (status in ('demanda', 'em_elaboracao', 'gestao_assinaturas', 'ativo')),
  data_inicio date not null,
  emissao_nf date,
  vencimento_tipo text not null check (vencimento_tipo in ('automatico', '15_dias')),
  vencimento_data date,
  responsavel text not null default '',
  testemunha_andressa boolean not null default false,
  testemunha_ana_paula boolean not null default false,
  decisao_notas text,
  destaque_risco boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists baps_contratos_status_idx on public.baps_contratos (status);

-- ---------------------------------------------------------------------------
-- Processos judicial / extrajudicial
-- ---------------------------------------------------------------------------
create table if not exists public.baps_processos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('judicial', 'extrajudicial')),
  parte_envolvida text not null,
  numero text not null default '',
  tribunal text not null default '',
  fase text not null check (fase in ('inicial', 'andamento', 'julgado', 'finalizado')),
  responsavel_escritorio text not null default '',
  atualizacao_semanal text not null default '',
  nivel_risco text not null check (nivel_risco in ('baixo', 'medio', 'alto')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Certidões
-- ---------------------------------------------------------------------------
create table if not exists public.baps_certidoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  data_ultima_emissao date not null,
  previsao_proxima date not null,
  status_pendencia text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Financeiro · resumo executivo (linha única id = 1)
-- ---------------------------------------------------------------------------
create table if not exists public.baps_financeiro_resumo (
  id int primary key default 1 check (id = 1),
  saldo_global numeric not null default 0,
  deficit_q1 numeric not null default 0,
  contas_bancarias text not null default '',
  pendencias text not null default '',
  inadimplencia_patrocinadores text not null default '',
  referencia_mes text not null default 'mar/2026',
  updated_at timestamptz not null default now()
);

create table if not exists public.baps_financeiro_eventos (
  id uuid primary key default gen_random_uuid(),
  nome_evento text not null,
  cidade text not null default '',
  receitas numeric not null default 0,
  despesas_pagas numeric not null default 0,
  referencia text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Associados · KPI consolidado (linha única)
-- ---------------------------------------------------------------------------
create table if not exists public.baps_associados_resumo (
  id int primary key default 1 check (id = 1),
  total_ativos int not null default 0,
  vencimentos_mes int not null default 0,
  saidas_mes int not null default 0,
  saidas_semana int not null default 0,
  saidas_ytd int not null default 0,
  notas_comercial text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Institucional · checklist (linha única)
-- ---------------------------------------------------------------------------
create table if not exists public.baps_institucional (
  id int primary key default 1 check (id = 1),
  atas_procuracoes_ok boolean not null default false,
  status_estatutario text not null default '',
  proxima_assembleia date,
  regimento_interno_ok boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5º Congresso · trilhas com semáforo
-- ---------------------------------------------------------------------------
create table if not exists public.baps_evento_trilhas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  status text not null check (status in ('success', 'warning', 'critical')),
  detalhe text not null default '',
  palestrantes text not null default '',
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- NPS comparativo por categoria e ano
-- ---------------------------------------------------------------------------
create table if not exists public.baps_nps_metricas (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  ano int not null,
  valor int not null,
  unique (categoria, ano)
);

-- ---------------------------------------------------------------------------
-- 5º Congresso · disponibilidade / ocupação (linha única id = 1, editável no portal)
-- ---------------------------------------------------------------------------
create table if not exists public.baps_congresso_disponibilidade (
  id int primary key default 1 check (id = 1),
  referencia text not null default 'mai/2026',
  congressistas_cp int not null default 0,
  residentes int not null default 0,
  gestores int not null default 0,
  pre_pos int not null default 0,
  videomakers int not null default 0,
  staffs int not null default 0,
  staffs_patrocinio int not null default 0,
  visitantes int not null default 0,
  lab_face int not null default 0,
  lab_corporal int not null default 0,
  baps_in_the_house int not null default 0,
  inscritos_total int not null default 0,
  congressistas_pagantes int not null default 0,
  congressistas_isentos int not null default 0,
  pal_face_isentos int not null default 0,
  pal_face_pagantes int not null default 0,
  pal_mama_isentos int not null default 0,
  pal_mama_pagantes int not null default 0,
  pal_corporal_isentos int not null default 0,
  pal_corporal_pagantes int not null default 0,
  pal_gestao_isentos int not null default 0,
  pal_gestao_pagantes int not null default 0,
  pal_prepos_isentos int not null default 0,
  pal_prepos_pagantes int not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS (leitura pública anon opcional — ajuste à sua política; MVP aberto leitura)
-- ---------------------------------------------------------------------------
alter table public.baps_contratos enable row level security;
alter table public.baps_processos enable row level security;
alter table public.baps_certidoes enable row level security;
alter table public.baps_financeiro_resumo enable row level security;
alter table public.baps_financeiro_eventos enable row level security;
alter table public.baps_associados_resumo enable row level security;
alter table public.baps_institucional enable row level security;
alter table public.baps_evento_trilhas enable row level security;
alter table public.baps_nps_metricas enable row level security;
alter table public.baps_congresso_disponibilidade enable row level security;

-- Políticas permissivas (ajuste em produção para JWT / papéis específicos).
drop policy if exists "baps_contratos_service_all" on public.baps_contratos;
drop policy if exists "baps_processos_service_all" on public.baps_processos;
drop policy if exists "baps_certidoes_service_all" on public.baps_certidoes;
drop policy if exists "baps_fin_resumo_service_all" on public.baps_financeiro_resumo;
drop policy if exists "baps_fin_ev_service_all" on public.baps_financeiro_eventos;
drop policy if exists "baps_assoc_service_all" on public.baps_associados_resumo;
drop policy if exists "baps_inst_service_all" on public.baps_institucional;
drop policy if exists "baps_trilhas_service_all" on public.baps_evento_trilhas;
drop policy if exists "baps_nps_service_all" on public.baps_nps_metricas;
drop policy if exists "baps_congresso_disp_service_all" on public.baps_congresso_disponibilidade;

create policy "baps_contratos_service_all" on public.baps_contratos for all using (true) with check (true);
create policy "baps_processos_service_all" on public.baps_processos for all using (true) with check (true);
create policy "baps_certidoes_service_all" on public.baps_certidoes for all using (true) with check (true);
create policy "baps_fin_resumo_service_all" on public.baps_financeiro_resumo for all using (true) with check (true);
create policy "baps_fin_ev_service_all" on public.baps_financeiro_eventos for all using (true) with check (true);
create policy "baps_assoc_service_all" on public.baps_associados_resumo for all using (true) with check (true);
create policy "baps_inst_service_all" on public.baps_institucional for all using (true) with check (true);
create policy "baps_trilhas_service_all" on public.baps_evento_trilhas for all using (true) with check (true);
create policy "baps_nps_service_all" on public.baps_nps_metricas for all using (true) with check (true);
create policy "baps_congresso_disp_service_all" on public.baps_congresso_disponibilidade for all using (true) with check (true);

comment on table public.baps_contratos is 'Contratos; status ativo remove da aba Demandas na UI.';
comment on table public.baps_processos is 'Processos judicial/extrajudicial com risco e atualização semanal.';

-- ---------------------------------------------------------------------------
-- Módulo Financeiro Estruturado (portal_*)
-- Tabelas para preenchimento mensal pelo setor financeiro.
-- Sem seed data — partem de zero, preenchidas pelo usuário.
-- ---------------------------------------------------------------------------

create table if not exists public.portal_contas_bancarias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('corrente', 'poupanca', 'investimento', 'outros')),
  banco text not null default '',
  saldo numeric not null default 0,
  data_saldo date not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_previsao_mensal (
  id uuid primary key default gen_random_uuid(),
  referencia_mes text not null unique,
  total_despesas_previstas numeric not null default 0,
  total_entradas_previstas numeric not null default 0,
  notas text default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_evento_resultado (
  id uuid primary key default gen_random_uuid(),
  nome_evento text not null,
  referencia_mes text not null,
  receita_bilheteria numeric not null default 0,
  receita_patrocinio numeric not null default 0,
  receita_outros numeric not null default 0,
  despesas_total numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_associados_historico (
  id uuid primary key default gen_random_uuid(),
  periodo_label text not null unique,
  ano int not null,
  mes int not null,
  total_ativos int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.portal_associados_mensal (
  id uuid primary key default gen_random_uuid(),
  ano int not null,
  mes int not null,
  total_inicio_mes int not null default 0,
  previsao_renovacoes int not null default 0,
  renovacoes_realizadas int not null default 0,
  novas_adesoes int not null default 0,
  saidas int not null default 0,
  updated_at timestamptz not null default now(),
  unique (ano, mes)
);

create table if not exists public.portal_custos_departamento (
  id uuid primary key default gen_random_uuid(),
  departamento text not null,
  referencia_mes text not null,
  valor_mensal numeric not null default 0,
  notas text default '',
  updated_at timestamptz not null default now(),
  unique (departamento, referencia_mes)
);

-- RLS para tabelas portal_*
alter table public.portal_contas_bancarias enable row level security;
alter table public.portal_previsao_mensal enable row level security;
alter table public.portal_evento_resultado enable row level security;
alter table public.portal_associados_historico enable row level security;
alter table public.portal_associados_mensal enable row level security;
alter table public.portal_custos_departamento enable row level security;

drop policy if exists "portal_contas_service_all" on public.portal_contas_bancarias;
drop policy if exists "portal_prev_service_all" on public.portal_previsao_mensal;
drop policy if exists "portal_ev_res_service_all" on public.portal_evento_resultado;
drop policy if exists "portal_assoc_hist_service_all" on public.portal_associados_historico;
drop policy if exists "portal_assoc_mes_service_all" on public.portal_associados_mensal;
drop policy if exists "portal_custos_service_all" on public.portal_custos_departamento;

create policy "portal_contas_service_all" on public.portal_contas_bancarias for all using (true) with check (true);
create policy "portal_prev_service_all" on public.portal_previsao_mensal for all using (true) with check (true);
create policy "portal_ev_res_service_all" on public.portal_evento_resultado for all using (true) with check (true);
create policy "portal_assoc_hist_service_all" on public.portal_associados_historico for all using (true) with check (true);
create policy "portal_assoc_mes_service_all" on public.portal_associados_mensal for all using (true) with check (true);
create policy "portal_custos_service_all" on public.portal_custos_departamento for all using (true) with check (true);

-- Sem INSERT seed — todas as tabelas portal_* começam vazias.

-- ---------------------------------------------------------------------------
-- Seed inicial removido — portal parte do zero sem dados demo.
-- Para popular o banco, use a interface do portal (setor financeiro/executivo).
-- ---------------------------------------------------------------------------
-- Todos os dados de seed foram removidos.
-- O portal inicia sem dados demo — preencha via interface ou via entrada-dados.

-- ---------------------------------------------------------------------------
-- Google Sheets Sync — lançamentos importados do e-Gestor
-- ---------------------------------------------------------------------------

-- Tabela principal: espelho completo da aba "personalizadoFinanceiro (13)"
-- Colunas mapeadas das 27 colunas (A→AA) da planilha real.
create table if not exists public.portal_lancamentos (
  id                    uuid primary key default gen_random_uuid(),

  -- Col A: Identificador único do e-Gestor
  cod                   text not null unique,

  -- Col B: Descrição do lançamento
  descricao             text,

  -- Col C: Conta Caixa (ex: "CAIXA DE FUNDAÇÃO BAPS", "VIACREDI")
  conta_caixa           text,

  -- Col D: Plano de contas base do e-Gestor (ex: "SÓCIOS FUNDADORES")
  plano_contas          text,

  -- Col E/X: Nome/Razão Social (preferindo col X — nome limpo)
  nome_razao_social     text,

  -- Col G: Forma de pagamento (PIX, DINHEIRO, etc.)
  forma_pagamento       text,

  -- Col H: Situação (Recebido | Pago | A receber | A pagar)
  situacao              text,

  -- Col I: Valor absoluto (despesas chegam negativas no e-Gestor → abs)
  valor                 numeric not null default 0,

  -- Col K: Data de vencimento
  data_vencimento       date,

  -- Col L: Data de pagamento
  data_pagamento        date,

  -- Col M: Data de créd/déb (efetivação bancária)
  data_cred_deb         date,

  -- Col P: Plano Primário de Contas enriquecido
  --        (ex: "DESPESAS OPERACIONAIS BAPS", "RECEITAS OPERACIONAIS BAPS")
  plano_primario_contas text,

  -- Col Q: Classificação de Contas
  --        (ex: "DESPESAS COM SERVIÇOS PROFISSIONAIS DE APOIO OPERACIONAL")
  classificacao         text,

  -- Col R: Sub Classificação de Contas
  --        (ex: "IMÓVEL - ALUGUEL", "PRESTAÇÃO DE SERVIÇOS DE CONTABILIDADE")
  sub_classificacao     text,

  -- Col S: Ent./Saída (Crédito | Débito)
  ent_saida             text,

  -- Col T: Rec./Des. (Receitas | Despesas)
  rec_desp              text,

  -- Col U: Tratativa (Empréstimos | Despesas | Receitas)
  tratativa             text,

  -- Col W: Tratativa Oculta de Nome/Razão Social
  tratativa_oculta      text,

  -- Col AA: Evento (ex: "OPERAÇÃO DE FUNDAÇÃO BAPS", "5º CONGRESSO BAPS")
  evento                text,

  -- Controle de sync
  synced_at             timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

-- Índices para queries frequentes
create index if not exists idx_lancamentos_evento           on public.portal_lancamentos (evento);
create index if not exists idx_lancamentos_situacao         on public.portal_lancamentos (situacao);
create index if not exists idx_lancamentos_rec_desp         on public.portal_lancamentos (rec_desp);
create index if not exists idx_lancamentos_data_vencimento  on public.portal_lancamentos (data_vencimento);
create index if not exists idx_lancamentos_data_pagamento   on public.portal_lancamentos (data_pagamento);
create index if not exists idx_lancamentos_conta_caixa      on public.portal_lancamentos (conta_caixa);
create index if not exists idx_lancamentos_plano_primario   on public.portal_lancamentos (plano_primario_contas);
create index if not exists idx_lancamentos_classificacao    on public.portal_lancamentos (classificacao);
create index if not exists idx_lancamentos_tratativa        on public.portal_lancamentos (tratativa);

-- Log de sincronizações
create table if not exists public.portal_sheets_sync_log (
  id             uuid primary key default gen_random_uuid(),
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text not null default 'running'
                   check (status in ('running', 'success', 'error')),
  rows_read      int default 0,
  rows_upserted  int default 0,
  error_message  text,
  triggered_by   text
);

-- RLS
alter table public.portal_lancamentos       enable row level security;
alter table public.portal_sheets_sync_log   enable row level security;

drop policy if exists "portal_lancamentos_service_all"     on public.portal_lancamentos;
drop policy if exists "portal_sheets_sync_log_service_all" on public.portal_sheets_sync_log;

create policy "portal_lancamentos_service_all"
  on public.portal_lancamentos for all using (true) with check (true);

create policy "portal_sheets_sync_log_service_all"
  on public.portal_sheets_sync_log for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Função RPC: totais agregados dos lançamentos (evita N+1 no cliente)
-- ---------------------------------------------------------------------------
-- p_ano (ex: '2025') filtra por data_pagamento/data_vencimento; null = tudo
-- Todas as comparações usam lower() para aceitar qualquer capitalização do e-Gestor
create or replace function public.lancamentos_totais(p_ano text default null)
returns table (
  total_receitas_pagas    numeric,
  total_despesas_pagas    numeric,
  total_a_receber         numeric,
  total_a_pagar           numeric,
  saldo_realizado         numeric,
  resultado_projetado     numeric,
  count_total             bigint
)
language sql
security definer
as $$
  with base as (
    select lower(rec_desp) as rd, lower(situacao) as sit, valor, data_pagamento, data_vencimento
    from public.portal_lancamentos
    where p_ano is null
       or (
         case
           when lower(situacao) in ('recebido','pago') then data_pagamento
           else data_vencimento
         end between (p_ano || '-01-01')::date and (p_ano || '-12-31')::date
       )
  )
  select
    coalesce(sum(valor) filter (where rd = 'receitas' and sit = 'recebido'), 0) as total_receitas_pagas,
    coalesce(sum(valor) filter (where rd = 'despesas' and sit = 'pago'),     0) as total_despesas_pagas,
    coalesce(sum(valor) filter (where sit = 'a receber'),                    0) as total_a_receber,
    coalesce(sum(valor) filter (where sit = 'a pagar'),                      0) as total_a_pagar,
    coalesce(sum(valor) filter (where rd = 'receitas' and sit = 'recebido'), 0)
      - coalesce(sum(valor) filter (where rd = 'despesas' and sit = 'pago'), 0) as saldo_realizado,
    coalesce(sum(valor) filter (where rd = 'receitas' and sit = 'recebido'), 0)
      - coalesce(sum(valor) filter (where rd = 'despesas' and sit = 'pago'), 0)
      + coalesce(sum(valor) filter (where sit = 'a receber'), 0)
      - coalesce(sum(valor) filter (where sit = 'a pagar'),   0) as resultado_projetado,
    count(*) as count_total
  from base;
$$;

-- Habilitar Supabase Realtime para portal_lancamentos
-- (execute este ALTER após criar/recriando o schema)
alter publication supabase_realtime add table public.portal_lancamentos;
