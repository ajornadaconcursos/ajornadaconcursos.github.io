-- A Jornada — Painel de Gestão (aba "Gestão", só para a equipe do Grupo RP).
-- Uma função só de leitura. Só contas com plano = 'dono' (administrador) conseguem chamar;
-- qualquer outra conta recebe "permission denied". Não altera nem apaga nada.
-- Rodar uma vez: Supabase → SQL Editor → colar → Run.

create or replace function public.painel_gestao() returns json
language plpgsql stable security definer set search_path = public as $$
declare r json;
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
      end as st
    from public.perfis p
  ),
  al as (select * from pf where st <> 'admin'),
  cp as (
    select c.*,
      (c.bruto::text like '%example@store.domain%' or c.bruto::text like '%"email": "example@%') as teste,
      case
        when c.evento ~* '(refund|chargeback|reembols)' then 'reembolso'
        when c.evento ~* 'cancel' then 'cancelamento'
        when c.evento ~* '(approved|renewed|complete|aprovad)' then 'venda'
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
      ) as liquido
    from public.compras c
  ),
  cr as (select * from cp where not teste),
  meses as (select generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') as m),
  dias as (select generate_series(current_date - 29, current_date, interval '1 day')::date as d)
  select json_build_object(
    'gerado_em', now(),
    'alunos', json_build_object(
      'total',        (select count(*) from al),
      'teste',        (select count(*) from al where st = 'teste'),
      'teste_venceu', (select count(*) from al where st = 'teste_venceu'),
      'assinantes',   (select count(*) from al where st = 'assinante'),
      'cortesia',     (select count(*) from al where st = 'cortesia'),
      'venceu',       (select count(*) from al where st = 'venceu'),
      'novos_7d',     (select count(*) from al where criado_em >= now() - interval '7 days'),
      'novos_30d',    (select count(*) from al where criado_em >= now() - interval '30 days'),
      'admins',       (select count(*) from pf where st = 'admin'),
      'aceitaram_termos', (select count(*) from al where aceite_termos is not null),
      'por_plano',    (select coalesce(json_object_agg(plano, n), '{}'::json) from (select plano, count(*) n from al where st = 'assinante' group by plano) x),
      'por_origem',   (select coalesce(json_object_agg(o, n), '{}'::json) from (select coalesce(nullif(origem,''),'sem origem') o, count(*) n from al where st = 'assinante' group by 1) x),
      'ativos_7d',    (select count(distinct d.user_id) from public.docs d join al on al.user_id = d.user_id where d.updated_at >= now() - interval '7 days'),
      'ativos_30d',   (select count(distinct d.user_id) from public.docs d join al on al.user_id = d.user_id where d.updated_at >= now() - interval '30 days')
    ),
    'cadastros_dia', (select json_agg(json_build_object('d', d, 'n', (select count(*) from al where criado_em::date = dias.d)) order by d) from dias),
    'cadastros_mes', (select json_agg(json_build_object('m', to_char(m,'YYYY-MM'), 'n', (select count(*) from al where date_trunc('month', criado_em) = meses.m)) order by m) from meses),
    'vendas_mes', (select json_agg(json_build_object('m', to_char(m,'YYYY-MM'),
        'n',        (select count(*) from cr where tipo='venda' and date_trunc('month', criado_em) = meses.m),
        'bruto',    (select coalesce(sum(valor),0) from cr where tipo='venda' and date_trunc('month', criado_em) = meses.m),
        'liquido',  (select coalesce(sum(coalesce(liquido, valor)),0) from cr where tipo='venda' and date_trunc('month', criado_em) = meses.m),
        'reembolso',(select coalesce(sum(valor),0) from cr where tipo='reembolso' and date_trunc('month', criado_em) = meses.m)
      ) order by m) from meses),
    'vendas_plano', (select coalesce(json_agg(json_build_object('plano', plano, 'bf', bf, 'n', n, 'bruto', b) order by b desc), '[]'::json) from (
        select coalesce(plano,'?') plano, (plano = 'anual' and valor between 440 and 460) bf, count(*) n, sum(valor) b
        from cr where tipo='venda' group by 1, 2) x),
    'totais', json_build_object(
      'bruto',        (select coalesce(sum(valor),0) from cr where tipo='venda'),
      'liquido',      (select coalesce(sum(coalesce(liquido, valor)),0) from cr where tipo='venda'),
      'vendas',       (select count(*) from cr where tipo='venda'),
      'reembolsos',   (select count(*) from cr where tipo='reembolso'),
      'reembolsos_valor', (select coalesce(sum(valor),0) from cr where tipo='reembolso'),
      'cancelamentos',(select count(*) from cr where tipo='cancelamento'),
      'mes_atual',    (select coalesce(sum(valor),0) from cr where tipo='venda' and criado_em >= date_trunc('month', now())),
      'mes_anterior', (select coalesce(sum(valor),0) from cr where tipo='venda' and criado_em >= date_trunc('month', now()) - interval '1 month' and criado_em < date_trunc('month', now())),
      'testes_ignorados', (select count(*) from cp where teste)
    ),
    'recentes', (select coalesce(json_agg(x order by x.em desc), '[]'::json) from (
        select criado_em em, tipo, evento, plano, valor, origem,
          case when email like '%@%' then left(split_part(email, '@', 1), 2) || '***@' || split_part(email, '@', 2) else '' end as email
        from cr order by criado_em desc limit 25) x),
    'ia', json_build_object(
      'hoje',      (select coalesce(sum(chamadas),0) from public.uso_ia where dia = current_date),
      'd30',       (select coalesce(sum(chamadas),0) from public.uso_ia where dia > current_date - 30),
      'tok_in_30', (select coalesce(sum(tokens_entrada),0) from public.uso_ia where dia > current_date - 30),
      'tok_out_30',(select coalesce(sum(tokens_saida),0) from public.uso_ia where dia > current_date - 30),
      'usuarios_30', (select count(distinct user_id) from public.uso_ia where dia > current_date - 30),
      'por_dia',   (select json_agg(json_build_object('d', d, 'n', (select coalesce(sum(chamadas),0) from public.uso_ia u where u.dia = dias.d)) order by d) from dias)
    )
  ) into r;
  return r;
end $$;
revoke execute on function public.painel_gestao() from public, anon;
grant execute on function public.painel_gestao() to authenticated;
