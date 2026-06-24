-- Remove o campo valor_total da DS (não é mais usado no sistema)
alter table public.descricoes_servico
  drop column if exists valor_total;
