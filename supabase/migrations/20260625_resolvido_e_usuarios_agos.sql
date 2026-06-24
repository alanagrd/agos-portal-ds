-- Marca alterações solicitadas como resolvidas
alter table public.historico_acoes
  add column if not exists resolvido boolean default false;

-- Tabela de usuários AGOS (nome completo vinculado ao usuário do auth)
create table if not exists public.usuarios_agos (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  criado_em timestamptz not null default now()
);

alter table public.usuarios_agos enable row level security;

create policy if not exists "Usuários autenticados podem ler usuarios_agos"
  on public.usuarios_agos for select
  to authenticated
  using (true);

create policy if not exists "Usuários podem inserir seu próprio registro"
  on public.usuarios_agos for insert
  to authenticated
  with check (auth.uid() = id);

create policy if not exists "Usuários podem atualizar seu próprio registro"
  on public.usuarios_agos for update
  to authenticated
  using (auth.uid() = id);

-- Exemplo: depois de criar o usuário no Auth, cadastre o nome completo aqui.
-- insert into public.usuarios_agos (id, nome, email)
-- select id, 'Nome Completo', email from auth.users where email = 'usuario@agosservicos.com.br'
-- on conflict (id) do update set nome = excluded.nome;
