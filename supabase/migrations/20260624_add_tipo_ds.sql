-- Adiciona o campo "tipo" na DS (VALE, FECHAMENTO, DISPENSA, OUTROS)

alter table public.descricoes_servico
  add column if not exists tipo text not null default 'OUTROS';

alter table public.descricoes_servico
  add constraint descricoes_servico_tipo_check
  check (tipo in ('VALE', 'FECHAMENTO', 'DISPENSA', 'OUTROS'));
