-- A Jornada — estrutura do banco no Supabase (já criada no projeto "A JORNADA - Sua Trilha Diária até Aprovação").
-- Só é preciso rodar de novo num projeto novo: Supabase → SQL Editor → New query → Run. Não apaga nada.

-- Dados do painel: cada "documento" do painel vira uma linha
create table if not exists public.docs (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  path       text not null,                    -- ex.: data/users/<seu id>/core
  parent     text not null,                    -- ex.: data/users/<seu id>
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, path)
);
create index if not exists docs_parent on public.docs (user_id, parent);
alter table public.docs enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='docs') then
    create policy "documentos do próprio usuário" on public.docs for all
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- Perfil (nome, plano e período de teste) e consumo da IA por dia
create table if not exists public.perfis (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  nome      text,
  plano     text,
  teste_ate timestamptz default (now() + interval '7 days'),
  criado_em timestamptz default now()
);
alter table public.perfis enable row level security;
create table if not exists public.uso_ia (
  user_id        uuid not null references auth.users(id) on delete cascade,
  dia            date not null default current_date,
  chamadas       integer not null default 0,
  tokens_entrada bigint not null default 0,
  tokens_saida   bigint not null default 0,
  primary key (user_id, dia)
);
alter table public.uso_ia enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='perfis') then
    create policy "leia o próprio perfil" on public.perfis for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='uso_ia') then
    create policy "ler o próprio uso" on public.uso_ia for select using (user_id = auth.uid());
  end if;
end $$;

create or replace function public.novo_usuario() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (user_id, nome) values (new.id, new.raw_user_meta_data->>'nome') on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists ao_cadastrar on auth.users;
create trigger ao_cadastrar after insert on auth.users for each row execute function public.novo_usuario();

create or replace function public.somar_uso_ia(uid uuid, ent bigint, sai bigint) returns void language sql security definer set search_path = public as $$
  insert into public.uso_ia (user_id, dia, chamadas, tokens_entrada, tokens_saida) values (uid, current_date, 1, ent, sai)
  on conflict (user_id, dia) do update set chamadas = uso_ia.chamadas + 1,
    tokens_entrada = uso_ia.tokens_entrada + excluded.tokens_entrada, tokens_saida = uso_ia.tokens_saida + excluded.tokens_saida;
$$;
revoke execute on function public.somar_uso_ia(uuid, bigint, bigint) from public, anon, authenticated;

-- Pasta privada dos PDFs e imagens: cada pessoa só abre a própria subpasta
insert into storage.buckets (id, name, public, file_size_limit)
values ('arquivos', 'arquivos', false, 52428800)
on conflict (id) do nothing;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='arquivos do próprio usuário') then
    create policy "arquivos do próprio usuário" on storage.objects for all to authenticated
      using (bucket_id = 'arquivos' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'arquivos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;
