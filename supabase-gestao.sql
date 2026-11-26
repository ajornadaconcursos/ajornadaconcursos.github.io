-- A Jornada — Centro de Controle (aba "Gestão", só para a equipe do Grupo RP).
-- Uma função só de leitura. Só contas com plano = 'dono' (administrador) conseguem chamar;
-- qualquer outra conta recebe "permission denied". Não altera nem apaga nada.
-- Rodar uma vez: Supabase → SQL Editor → colar → Run. Pode rodar de novo sem problema.

create or replace function public.painel_gestao() returns json
language plpgsql stable security definer set search_path = public as $$
declare r json; hoje date := (now() at time zone 'America/Campo_Grande')::date;
begin
  if not exists (select 1 from public.perfis where user_id = auth.uid() and plano = 'dono') then
    raise exception 'permission denied';
  end if;

  with
  pf as (
    select p.*,
      case
        when p.plano = 'dono' then 'admin'
        when p.plano = 'cortesia' and (p.plano_ate is null or p.plano_ate > now()) then 'cortesia'
        when (p.plano in ('mensal','trimestral','semestral','anual') or p.plano like 'basico\_%')
             and (p.plano_ate is null or p.plano_ate > now()) then 'assinante'
        when (p.plano in ('mensal','trimestral','semestral','anual','cortesia') or p.plano like 'basico\_%') then 'venceu'
        when coalesce(p.teste_ate, p.criado_em + interval '7 days') > now() then 'teste'
        else 'teste_venceu'
      end as st,
      (p.criado_em at time zone 'America/Campo_Grande')::date as dia_cad
    from public.perfis p
  ),
  al as (select * from pf where st <> 'admin'),
  -- dias em que cada aluno usou a plataforma (cadastro, IA ou dados salvos)
  atv as (
    select user_id, dia_cad as d from al
    union select user_id, dia from public.uso_ia
    union select user_id, (updated_at at time zone 'America/Campo_Grande')::date from public.docs
  ),
  ult as (select user_id, max(d) d from atv group by user_id),
  ia30 as (select user_id, sum(chamadas) n from public.uso_ia where dia > hoje - 30 group by user_id),
  cp as (
    select c.*,
      (c.bruto::text like '%example@store.domain%' or c.bruto::text like '%"email": "example@%') as teste,
      case
        when c.evento ~* '(refund|chargeback|reembols)' then 'reembolso'
        when c.evento ~* 'cancel' then 'cancelamento'
        when c.evento ~* '(late|overdue|atras)' then 'atraso'
        when c.evento ~* '(approved|renewed|complete|aprovad)' then 'venda'
        when c.evento ~* '(billet|boleto|pix_created|waiting|pending|aguard)' then 'pendente'
        when c.evento ~* '(rejected|refused|recus)' then 'recusado'
        else 'outro'
      end as tipo,
      coalesce(
        nullif(c.bruto->'Commissions'->>'charge_amount','')::numeric / 100,
        nullif(c.bruto->'data'->'purchase'->'price'->>'value','')::numeric,
        case c.plano when 'mensal' then 79.90 when 'semestral' then 299.40 when 'anual' then 549.90
          when 'trimestral' then 179.90 when 'basico_mensal' then 49.90 when 'basico_anual' then 358.80 else 0 end
      ) as valor,
      coalesce(
        nullif(c.bruto->'Commissions'->>'my_commission','')::numeric / 100,
        nullif(c.bruto->'data'->'commissions'->0->>'value','')::numeric
      ) as liquido,
      coalesce(c.bruto->>'payment_method', c.bruto->'data'->'purchase'->'payment'->>'type') as metodo,
      (c.criado_em at time zone 'America/Campo_Grande')::date as dia
    from public.compras c
  ),
  cr as (select * from cp where not teste),
  meses as (select generate_series(date_trunc('month', hoje) - interval '11 months', date_trunc('month', hoje), interval '1 month')::date as m),
  dias as (select generate_series(hoje - 29, hoje, interval '1 day')::date as d),
  coh as (select date_trunc('week', dia_cad)::date w, user_id from al where dia_cad >= date_trunc('week', hoje)::date - 35),
  ret as (
    select c.w, k, count(*) n,
      count(*) filter (where exists (select 1 from atv a where a.user_id = c.user_id and a.d >= c.w + 7*k and a.d < c.w + 7*k + 7)) ok
    from coh c cross join generate_series(0, 3) k group by c.w, k
  )
  select json_build_object(
    'gerado_em', now(),
    'hoje', hoje,
    'alunos', json_build_object(
      'total',        (select count(*) from al),
      'teste',        (select count(*) from al where st = 'teste'),
      'teste_venceu', (select count(*) from al where st = 'teste_venceu'),
      'assinantes',   (select count(*) from al where st = 'assinante'),
      'cortesia',     (select count(*) from al where st = 'cortesia'),
      'venceu',       (select count(*) from al where st = 'venceu'),
      'novos_7d',     (select count(*) from al where dia_cad > hoje - 7),
      'novos_7d_ant', (select count(*) from al where dia_cad > hoje - 14 and dia_cad <= hoje - 7),
      'novos_30d',    (select count(*) from al where dia_cad > hoje - 30),
      'teste_acaba_2d', (select count(*) from al where st = 'teste' and teste_ate <= now() + interval '2 days'),
      'admins',       (select count(*) from pf where st = 'admin'),
      'aceitaram_termos', (select count(*) from al where aceite_termos is not null),
      'por_plano',    (select coalesce(json_object_agg(plano, n), '{}'::json) from (select plano, count(*) n from al where st = 'assinante' group by plano) x),
      'ativos_7d',    (select count(*) from ult join al using (user_id) where ult.d > hoje - 7),
      'ativos_30d',   (select count(*) from ult join al using (user_id) where ult.d > hoje - 30)
    ),
    'lista', (select coalesce(json_agg(x order by x.cad desc), '[]'::json) from (
        select al.nome, al.email, al.plano, al.st, al.criado_em cad, al.teste_ate, al.plano_ate, al.origem,
          ult.d ultimo, coalesce(ia30.n, 0) ia
        from al left join ult using (user_id) left join ia30 using (user_id)
        order by al.criado_em desc limit 500) x),
    'cadastros_dia', (select json_agg(json_build_object('d', d, 'n', (select count(*) from al where dia_cad = dias.d)) order by d) from dias),
    'ativos_dia', (select json_agg(json_build_object('d', d, 'n', (select count(distinct a.user_id) from atv a join al using (user_id) where a.d = dias.d)) order by d) from dias),
    'retencao', (select coalesce(json_agg(json_build_object('w', w, 'n', n, 'p', p) order by w desc), '[]'::json) from (
        select w, max(n) n, json_agg(case when w + 7*k > hoje then null when w + 7*k + 7 > hoje then -1 else round(ok * 100.0 / n) end order by k) p
        from ret group by w) x),
    'vendas_mes', (select json_agg(json_build_object('m', to_char(m,'YYYY-MM'),
        'n',        (select count(*) from cr where tipo='venda' and date_trunc('month', dia) = meses.m),
        'bruto',    (select coalesce(sum(valor),0) from cr where tipo='venda' and date_trunc('month', dia) = meses.m),
        'liquido',  (select coalesce(sum(coalesce(liquido, valor)),0) from cr where tipo='venda' and date_trunc('month', dia) = meses.m),
        'reembolso',(select coalesce(sum(valor),0) from cr where tipo='reembolso' and date_trunc('month', dia) = meses.m),
        'novos',    (select count(*) from al where date_trunc('month', dia_cad) = meses.m)
      ) order by m) from meses),
    'vendas_dia', (select json_agg(json_build_object('d', d, 'v', (select coalesce(sum(valor),0) from cr where tipo='venda' and cr.dia = dias.d), 'n', (select count(*) from cr where tipo='venda' and cr.dia = dias.d)) order by d) from dias),
    'vendas_plano', (select coalesce(json_agg(json_build_object('plano', plano, 'bf', bf, 'n', n, 'bruto', b) order by b desc), '[]'::json) from (
        select coalesce(plano,'?') plano, (plano = 'anual' and valor between 440 and 460) bf, count(*) n, sum(valor) b
        from cr where tipo='venda' group by 1, 2) x),
    'metodos', (select coalesce(json_object_agg(m, n), '{}'::json) from (select coalesce(metodo,'outro') m, count(*) n from cr where tipo='venda' group by 1) x),
    'totais', json_build_object(
      'bruto',        (select coalesce(sum(valor),0) from cr where tipo='venda'),
      'liquido',      (select coalesce(sum(coalesce(liquido, valor)),0) from cr where tipo='venda'),
      'vendas',       (select count(*) from cr where tipo='venda'),
      'reembolsos',   (select count(*) from cr where tipo='reembolso'),
      'reembolsos_valor', (select coalesce(sum(valor),0) from cr where tipo='reembolso'),
      'cancelamentos',(select count(*) from cr where tipo='cancelamento'),
      'atrasos',      (select count(*) from cr where tipo='atraso' and dia > hoje - 30),
      'pendentes',    (select count(*) from cr where tipo='pendente' and dia > hoje - 7),
      'semana',       (select coalesce(sum(valor),0) from cr where tipo='venda' and dia > hoje - 7),
      'semana_ant',   (select coalesce(sum(valor),0) from cr where tipo='venda' and dia > hoje - 14 and dia <= hoje - 7),
      'mes_atual',    (select coalesce(sum(valor),0) from cr where tipo='venda' and dia >= date_trunc('month', hoje)),
      'mes_anterior', (select coalesce(sum(valor),0) from cr where tipo='venda' and dia >= date_trunc('month', hoje) - interval '1 month' and dia < date_trunc('month', hoje)),
      'testes_ignorados', (select count(*) from cp where teste)
    ),
    'pagamentos', (select coalesce(json_agg(x order by x.em desc), '[]'::json) from (
        select criado_em em, tipo, evento, plano, valor, liquido, metodo, origem, email, ate
        from cr order by criado_em desc limit 200) x),
    'ia', json_build_object(
      'hoje',      (select coalesce(sum(chamadas),0) from public.uso_ia where dia = hoje),
      'd7',        (select coalesce(sum(chamadas),0) from public.uso_ia where dia > hoje - 7),
      'd30',       (select coalesce(sum(chamadas),0) from public.uso_ia where dia > hoje - 30),
      'tok_in_30', (select coalesce(sum(tokens_entrada),0) from public.uso_ia where dia > hoje - 30),
      'tok_out_30',(select coalesce(sum(tokens_saida),0) from public.uso_ia where dia > hoje - 30),
      'usuarios_30', (select count(distinct user_id) from public.uso_ia where dia > hoje - 30),
      'por_dia',   (select json_agg(json_build_object('d', d, 'n', (select coalesce(sum(chamadas),0) from public.uso_ia u where u.dia = dias.d)) order by d) from dias)
    )
  ) into r;
  return r;
end $$;
revoke execute on function public.painel_gestao() from public, anon;
grant execute on function public.painel_gestao() to authenticated;

-- ---------- Finanças da Gestão: custos, contas e metas da empresa ----------
-- Só contas de administrador (plano = 'dono') leem e gravam. Alunos não enxergam nada desta tabela.
create or replace function public.e_gestor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where user_id = auth.uid() and plano = 'dono');
$$;
revoke execute on function public.e_gestor() from public, anon;
grant execute on function public.e_gestor() to authenticated;

create table if not exists public.gestao_lanc (
  id         bigserial primary key,
  tipo       text not null default 'despesa' check (tipo in ('despesa', 'receita', 'meta')),
  nome       text not null,
  categoria  text,
  valor      numeric(12,2) not null default 0,
  mes        text,                 -- mês de referência, ex.: 2026-11 (metas não usam)
  dia        date,                 -- vencimento
  fixo       boolean not null default false,   -- custo que se repete todo mês
  pago       boolean not null default false,
  pago_em    timestamptz,
  criado_por uuid default auth.uid(),
  criado_em  timestamptz not null default now()
);
create index if not exists gestao_lanc_mes on public.gestao_lanc (mes);
alter table public.gestao_lanc enable row level security;
revoke all on public.gestao_lanc from anon;
drop policy if exists "só a equipe do grupo" on public.gestao_lanc;
create policy "só a equipe do grupo" on public.gestao_lanc for all to authenticated
  using (public.e_gestor()) with check (public.e_gestor());
