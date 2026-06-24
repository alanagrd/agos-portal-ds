-- Adiciona o código do cliente na obra, para facilitar identificação
alter table public.obras
  add column if not exists codigo_cliente text;
