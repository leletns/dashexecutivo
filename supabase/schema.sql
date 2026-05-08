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
-- Seed inicial (primeira apresentação · até mar/2026)
-- ---------------------------------------------------------------------------
insert into public.baps_financeiro_resumo (id, saldo_global, deficit_q1, contas_bancarias, pendencias, inadimplencia_patrocinadores, referencia_mes)
values (
  1,
  1190000,
  -25900,
  'Contas operacionais consolidadas sob revisão da diretoria.',
  'Conciliações de cartão e notas de terceiros em fechamento mensal.',
  'Acompanhamento amigável com cartas de cobrança padronizadas.',
  'mar/2026'
)
on conflict (id) do nothing;

insert into public.baps_financeiro_eventos (nome_evento, cidade, receitas, despesas_pagas, referencia)
select 'Summit Turismo Saúde', 'Goiânia', 82590, 106102, 'Mar/2026 · resultado controlado na diretoria'
where not exists (
  select 1 from public.baps_financeiro_eventos e where e.nome_evento = 'Summit Turismo Saúde'
);

insert into public.baps_associados_resumo (id, total_ativos, vencimentos_mes, saidas_mes, saidas_semana, saidas_ytd, notas_comercial)
values (
  1,
  428,
  36,
  5,
  2,
  18,
  'Patrocinadores: consolidar clareza com cenografia e SLAs de entrega de leads pós-evento.'
)
on conflict (id) do nothing;

insert into public.baps_institucional (id, atas_procuracoes_ok, status_estatutario, proxima_assembleia, regimento_interno_ok)
values (1, true, 'Regular · sem pendências cadastrais na Junta.', '2026-06-18', true)
on conflict (id) do nothing;

insert into public.baps_evento_trilhas (slug, nome, status, detalhe, palestrantes, ordem) values
('face', 'Face', 'success', 'Palestrantes Bravo/Kassir confirmados.', 'Francisco Bravo · Ramtin Kassir', 1),
('mama', 'Mama', 'warning', 'Aguardando 9 convites nacionais.', 'Ernesto Buccheri · Francisco Bravo · Reynaldo Llamas', 2),
('corporal', 'Corporal', 'critical', 'Atraso crítico; 6 internacionais sem convite.', 'Equipe produção · revisão diretoria', 3),
('pre-pos', 'Pré e Pós', 'warning', 'Estrutura pronta; pendências administrativas em fechamento.', 'Coordenação acadêmica · secretaria', 4),
('gestao', 'Gestão', 'critical', 'Sem entregas iniciais.', 'PMO · operações', 5)
on conflict (slug) do nothing;

insert into public.baps_congresso_disponibilidade (
  id, referencia, congressistas_cp, residentes, gestores, pre_pos, videomakers,
  staffs, staffs_patrocinio, visitantes, lab_face, lab_corporal, baps_in_the_house,
  inscritos_total, congressistas_pagantes, congressistas_isentos
)
values (
  1, 'mai/2026', 400, 30, 150, 120, 30,
  0, 0, 0, 10, 12, 40,
  0, 100, 0
)
on conflict (id) do nothing;

insert into public.baps_nps_metricas (categoria, ano, valor) values
('Doctors', 2024, 34),
('Doctors', 2025, 54),
('Pré/Pós', 2024, 39),
('Pré/Pós', 2025, 71),
('Gestores', 2024, 42),
('Gestores', 2025, 65)
on conflict (categoria, ano) do nothing;

insert into public.baps_contratos (fornecedor, status, data_inicio, emissao_nf, vencimento_tipo, vencimento_data, responsavel, testemunha_andressa, testemunha_ana_paula, decisao_notas, destaque_risco)
select * from (values
(
  'Salvador · operação logística premium',
  'gestao_assinaturas'::text,
  '2026-02-10'::date,
  null::date,
  '15_dias'::text,
  '2026-03-15'::date,
  'Diretoria Jurídica'::text,
  true,
  false,
  'Decisão: minuta não habitual aprovada com cláusulas de SLA e multa simétrica; envio para assinatura física na segunda rodada.'::text,
  true
),
(
  'Fornecedor de Cabeças de Noronha',
  'em_elaboracao'::text,
  '2026-01-05'::date,
  null::date,
  'automatico'::text,
  null::date,
  'Procuradoria interna'::text,
  true,
  true,
  'Decisão: contingenciamento de pagamentos até homologação final do escopo; parecer externo arquivado junto ao dossiê.'::text,
  true
),
(
  'Audiovisual institucional',
  'demanda'::text,
  '2026-03-01'::date,
  null::date,
  '15_dias'::text,
  null::date,
  'Marketing'::text,
  false,
  false,
  null::text,
  false
),
(
  'Infraestrutura cloud corporativa',
  'ativo'::text,
  '2025-08-01'::date,
  '2025-08-05'::date,
  'automatico'::text,
  '2026-08-01'::date,
  'TI'::text,
  false,
  true,
  null::text,
  false
)) as v(fornecedor, status, data_inicio, emissao_nf, vencimento_tipo, vencimento_data, responsavel, testemunha_andressa, testemunha_ana_paula, decisao_notas, destaque_risco)
where not exists (
  select 1 from public.baps_contratos c where c.fornecedor = v.fornecedor
);

insert into public.baps_processos (tipo, parte_envolvida, numero, tribunal, fase, responsavel_escritorio, atualizacao_semanal, nivel_risco)
select * from (values
('judicial'::text, 'Cenografia Brasil Ltda.', '0001234-56.2025.8.26.0100', 'TJSP · 5ª Vara Cível', 'andamento'::text, 'Escritório Meyer', 'Contestação protocolada; aguardando audiência de conciliação.', 'medio'::text),
('extrajudicial', 'TGMED Serviços', 'EXT-2025-089', '—', 'inicial', 'Escritório Meyer', 'Notificação extrajudicial enviada; prazo 15 dias.', 'baixo'),
('judicial', 'Mtech Indústria', '0008877-11.2024.8.05.0001', 'TJBA · Comercial', 'julgado', 'Escritório Meyer', 'Sentença publicada; análise de recurso.', 'alto'),
('extrajudicial', 'Sucesso Médico Editora', 'EXT-2026-014', '—', 'andamento', 'Escritório Meyer', 'Proposta de acordo em revisão.', 'medio'),
('judicial', 'Ammare Holding', '0005512-33.2025.8.13.0024', 'TJMG · Fazenda', 'inicial', 'Escritório Meyer', 'Distribuição confirmada; citação pendente.', 'alto'),
('extrajudicial', 'App Delivery Partners', 'EXT-2026-031', '—', 'finalizado', 'Escritório Meyer', 'Acordo homologado e quitado.', 'baixo'),
('judicial', 'Internet Fiber Co.', '0009988-22.2023.8.26.0100', 'TJSP · 12ª Vara', 'andamento', 'Escritório Meyer', 'Perícia técnica designada.', 'medio'),
('judicial', 'Correios · contrato histórico', '0004421-88.2022.4.03.6100', 'TRF3', 'andamento', 'Escritório Meyer', 'Aguardando manifestação da autarquia.', 'medio'),
('judicial', 'Uber Brasil', '0007744-55.2025.8.26.0100', 'TJSP · Cível', 'inicial', 'Escritório Meyer', 'Audiência inicial marcada.', 'baixo'),
('judicial', 'Fast Limpeza Facilities', '0003322-77.2026.8.26.0100', 'TJSP · Vara do Trabalho', 'inicial', 'Escritório Meyer', 'Reunião com RH na quinta-feira.', 'alto'),
('extrajudicial', 'Neo Capital', 'EXT-2026-052', '—', 'andamento', 'Escritório Meyer', 'Due diligence documental em curso.', 'medio'),
('judicial', 'Héctor Duran · quota societária', '0006611-44.2025.8.26.0100', 'TJSP · Empresarial', 'andamento', 'Escritório Meyer', 'Audiência de instrução agendada.', 'alto')) as p(tipo, parte_envolvida, numero, tribunal, fase, responsavel_escritorio, atualizacao_semanal, nivel_risco)
where not exists (
  select 1 from public.baps_processos x where x.parte_envolvida = p.parte_envolvida and x.numero = p.numero
);

insert into public.baps_certidoes (nome, data_ultima_emissao, previsao_proxima, status_pendencia)
select * from (values
('Certidão negativa de débitos federais'::text, '2025-11-12'::date, '2026-05-12'::date, 'Sem pendências'::text),
('Certidão estadual FGTS', '2025-10-02'::date, '2026-04-02'::date, 'Renovar antes do próximo board'),
('Certidão municipal ISS', '2025-12-20'::date, '2026-06-15'::date, 'Aguardando protocolo eletrônico')) as c(nome, data_ultima_emissao, previsao_proxima, status_pendencia)
where not exists (select 1 from public.baps_certidoes z where z.nome = c.nome);
