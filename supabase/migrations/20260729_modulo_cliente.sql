-- MÓDULO CLIENTE: funções RLS, tabela de códigos, policies restrictive

create or replace function public.email_do_usuario()
returns text language sql stable as $$
  select lower(trim(coalesce(auth.jwt() ->> 'email', '')))
$$;

create or replace function public.is_agos()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios_agos where id = auth.uid())
$$;

create or replace function public.obras_do_usuario()
returns setof uuid language sql stable security definer set search_path = public as $$
  select o.id from public.obras o
  where public.email_do_usuario() <> ''
    and (
      lower(trim(coalesce(o.responsavel_email, ''))) = public.email_do_usuario()
      or exists (
        select 1 from unnest(coalesce(o.emails_copia, array[]::text[])) as e
        where lower(trim(e)) = public.email_do_usuario()
      )
    )
$$;

create or replace function public.ds_do_usuario()
returns setof uuid language sql stable security definer set search_path = public as $$
  select d.id from public.descricoes_servico d
  where d.obra_id in (select public.obras_do_usuario())
    and d.status not in ('Gerada', 'Em análise interna')
$$;

grant execute on function
  public.email_do_usuario(),
  public.is_agos(),
  public.obras_do_usuario(),
  public.ds_do_usuario()
to authenticated;

-- Tabela de códigos de verificação — sem nenhuma policy (só service_role acessa)
create table if not exists public.codigos_verificacao (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null,
  codigo_hash text       not null,
  expira_em  timestamptz not null,
  tentativas int         not null default 0,
  usado      boolean     not null default false,
  criado_em  timestamptz not null default now()
);
create index if not exists idx_codigos_email on public.codigos_verificacao (email, criado_em desc);
alter table public.codigos_verificacao enable row level security;

-- ── obras ──────────────────────────────────────────────────────────────────
drop policy if exists "restr_obras_select" on public.obras;
create policy "restr_obras_select" on public.obras
  as restrictive for select to authenticated
  using (public.is_agos() or id in (select public.obras_do_usuario()));

drop policy if exists "restr_obras_insert" on public.obras;
create policy "restr_obras_insert" on public.obras
  as restrictive for insert to authenticated
  with check (public.is_agos());

drop policy if exists "restr_obras_update" on public.obras;
create policy "restr_obras_update" on public.obras
  as restrictive for update to authenticated
  using (public.is_agos()) with check (public.is_agos());

drop policy if exists "restr_obras_delete" on public.obras;
create policy "restr_obras_delete" on public.obras
  as restrictive for delete to authenticated
  using (public.is_agos());

-- ── descricoes_servico ─────────────────────────────────────────────────────
drop policy if exists "restr_descricoes_servico_select" on public.descricoes_servico;
create policy "restr_descricoes_servico_select" on public.descricoes_servico
  as restrictive for select to authenticated
  using (public.is_agos() or id in (select public.ds_do_usuario()));

drop policy if exists "restr_descricoes_servico_insert" on public.descricoes_servico;
create policy "restr_descricoes_servico_insert" on public.descricoes_servico
  as restrictive for insert to authenticated
  with check (public.is_agos());

drop policy if exists "restr_descricoes_servico_update" on public.descricoes_servico;
create policy "restr_descricoes_servico_update" on public.descricoes_servico
  as restrictive for update to authenticated
  using (public.is_agos()) with check (public.is_agos());

drop policy if exists "restr_descricoes_servico_delete" on public.descricoes_servico;
create policy "restr_descricoes_servico_delete" on public.descricoes_servico
  as restrictive for delete to authenticated
  using (public.is_agos());

-- ── versoes_pdf ────────────────────────────────────────────────────────────
drop policy if exists "restr_versoes_pdf_select" on public.versoes_pdf;
create policy "restr_versoes_pdf_select" on public.versoes_pdf
  as restrictive for select to authenticated
  using (public.is_agos() or ds_id in (select public.ds_do_usuario()));

drop policy if exists "restr_versoes_pdf_insert" on public.versoes_pdf;
create policy "restr_versoes_pdf_insert" on public.versoes_pdf
  as restrictive for insert to authenticated
  with check (public.is_agos());

drop policy if exists "restr_versoes_pdf_update" on public.versoes_pdf;
create policy "restr_versoes_pdf_update" on public.versoes_pdf
  as restrictive for update to authenticated
  using (public.is_agos()) with check (public.is_agos());

drop policy if exists "restr_versoes_pdf_delete" on public.versoes_pdf;
create policy "restr_versoes_pdf_delete" on public.versoes_pdf
  as restrictive for delete to authenticated
  using (public.is_agos());

-- ── historico_acoes ────────────────────────────────────────────────────────
drop policy if exists "restr_historico_acoes_select" on public.historico_acoes;
create policy "restr_historico_acoes_select" on public.historico_acoes
  as restrictive for select to authenticated
  using (
    public.is_agos()
    or (ds_id in (select public.ds_do_usuario()) and tipo <> 'interno')
  );

drop policy if exists "restr_historico_acoes_insert" on public.historico_acoes;
create policy "restr_historico_acoes_insert" on public.historico_acoes
  as restrictive for insert to authenticated
  with check (public.is_agos());

drop policy if exists "restr_historico_acoes_update" on public.historico_acoes;
create policy "restr_historico_acoes_update" on public.historico_acoes
  as restrictive for update to authenticated
  using (public.is_agos()) with check (public.is_agos());

drop policy if exists "restr_historico_acoes_delete" on public.historico_acoes;
create policy "restr_historico_acoes_delete" on public.historico_acoes
  as restrictive for delete to authenticated
  using (public.is_agos());

-- ── usuarios_agos ──────────────────────────────────────────────────────────
drop policy if exists "restr_usuarios_agos_select" on public.usuarios_agos;
create policy "restr_usuarios_agos_select" on public.usuarios_agos
  as restrictive for select to authenticated
  using (public.is_agos() or id = auth.uid());

-- Marcar usuários AGOS existentes com perfil no app_metadata
update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
                        || jsonb_build_object('perfil', 'agos')
where exists (select 1 from public.usuarios_agos a where a.id = u.id);
