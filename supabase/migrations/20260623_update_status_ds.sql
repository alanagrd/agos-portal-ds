-- Atualiza o fluxo de status das DSs:
-- Gerada -> Em análise interna -> Alteração solicitada -> Em análise interna -> Aguardando aprovação da obra -> Aprovada
-- (Aguardando aprovação da obra -> Alteração solicitada também é possível)

-- 1. Remove o CHECK constraint antigo na coluna status, se existir
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.descricoes_servico'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.descricoes_servico drop constraint %I', c.conname);
  end loop;
end $$;

-- 2. Migra os dados existentes para os novos nomes de status
update public.descricoes_servico set status = 'Em análise interna' where status = 'Em conferência interna';
update public.descricoes_servico set status = 'Aguardando aprovação da obra' where status = 'Aguardando aprovação';
update public.descricoes_servico set status = 'Alteração solicitada' where status = 'Em revisão';

-- 3. Cria o novo CHECK constraint com os 5 status válidos
alter table public.descricoes_servico
  add constraint descricoes_servico_status_check
  check (status in (
    'Gerada',
    'Em análise interna',
    'Alteração solicitada',
    'Aguardando aprovação da obra',
    'Aprovada'
  ));
