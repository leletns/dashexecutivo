-- ============================================================
-- DIAGNÓSTICO E CORREÇÕES — execute no Supabase SQL Editor
-- ============================================================

-- PASSO 1: Verificar o que está armazenado em portal_lancamentos
-- Mostra distribuição de rec_desp e situacao (para detectar problemas)
SELECT
  rec_desp,
  lower(rec_desp) AS rec_desp_lower,
  situacao,
  lower(situacao) AS situacao_lower,
  count(*) AS qtd,
  round(sum(valor)::numeric, 2) AS total_valor
FROM public.portal_lancamentos
GROUP BY rec_desp, lower(rec_desp), situacao, lower(situacao)
ORDER BY qtd DESC
LIMIT 50;


-- PASSO 2: Atualizar a função lancamentos_totais com lower() para aceitar
-- qualquer capitalização ("Recebido", "RECEBIDO", "recebido" etc.)
-- Execute este bloco completo:

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


-- PASSO 3: Habilitar Realtime para atualizações ao vivo no dashboard
-- (pode mostrar "already exists" — tudo bem)
alter publication supabase_realtime add table public.portal_lancamentos;


-- PASSO 4 (opcional): Testar a função atualizada
SELECT * FROM public.lancamentos_totais();

-- PASSO 4b (opcional): Testar com filtro de ano
SELECT * FROM public.lancamentos_totais('2026');


-- PASSO 5: Ver os primeiros 10 lançamentos para confirmar dados
SELECT cod, situacao, rec_desp, valor, data_pagamento, data_vencimento
FROM public.portal_lancamentos
ORDER BY synced_at DESC
LIMIT 10;
