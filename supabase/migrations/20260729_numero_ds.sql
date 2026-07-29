alter table public.descricoes_servico
  add column if not exists numero_ds text;

-- Backfill a partir do nome do arquivo da primeira versão de cada DS
update public.descricoes_servico d
set numero_ds = sub.numero
from (
  select distinct on (v.ds_id) v.ds_id,
         substring(v.storage_path from 'DS[_-]?([0-9]{3,})') as numero
  from public.versoes_pdf v
  order by v.ds_id, v.numero_versao asc
) sub
where sub.ds_id = d.id
  and sub.numero is not null
  and d.numero_ds is null;
