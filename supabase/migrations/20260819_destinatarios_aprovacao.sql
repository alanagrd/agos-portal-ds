-- Tabela de destinatários individuais de links de aprovação de DS.
-- Cada destinatário (responsável + emails em cópia) recebe um token único,
-- permitindo rastrear exatamente quem aprovou ou solicitou alteração.

create table public.destinatarios_aprovacao (
  id        uuid        primary key default gen_random_uuid(),
  ds_id     uuid        not null references public.descricoes_servico(id) on delete cascade,
  nome      text        not null,
  email     text        not null,
  tipo      text        not null check (tipo in ('responsavel', 'copia')),
  token     uuid        not null default gen_random_uuid() unique,
  criado_em timestamptz not null default now()
);

create index on public.destinatarios_aprovacao (ds_id);
create index on public.destinatarios_aprovacao (token);

alter table public.destinatarios_aprovacao enable row level security;

-- Leitura pública por token (página /aprovar/[token] não tem auth)
create policy "Leitura publica por token" on public.destinatarios_aprovacao
  for select using (true);

-- Inserção apenas por usuários autenticados (ADMs AGOS ao disparar o envio)
create policy "Insercao por autenticados" on public.destinatarios_aprovacao
  for insert to authenticated with check (true);
