-- Adiciona email do autor nas ações do histórico, para notificações por email
alter table public.historico_acoes
  add column if not exists autor_email text;
