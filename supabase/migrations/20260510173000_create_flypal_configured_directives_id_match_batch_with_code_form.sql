begin;

create index if not exists idx_flypal_cfg_dir_pending_match_with_code_form
  on flypal.flypal_configured_directives (
    tenant_id,
    assembly_models,
    directive_no,
    reference_amp,
    category_code,
    ata_code,
    code_form_no
  )
  where coalesce(is_row_processed_success, false) = false;

create index if not exists idx_directives_match_lookup_with_code_form
  on public.directives (
    tenant_id,
    assembly_models,
    directive_no,
    reference_amp,
    category_code,
    ata_code,
    code_form_no
  );

create or replace function public.flypal_configured_directives_id_match_batch_with_code_form(
  p_batch_size integer default 1000
)
returns table (
  row_id text,
  is_success boolean,
  failure_reason text
)
language sql
security definer
set search_path = public, flypal
as $$
  with candidate_rows as (
    select
      f.id,
      f.tenant_id,
      f.assembly_models,
      f.directive_no,
      f.reference_amp,
      f.category_code,
      f.ata_code,
      f.code_form_no
    from flypal.flypal_configured_directives f
    where coalesce(f.is_row_processed_success, false) = false
    order by f.frequency_sequence asc nulls last, f.id asc
    limit greatest(1, least(coalesce(p_batch_size, 1000), 5000))
    for update skip locked
  ),
  matched as (
    select
      c.id as cfg_id,
      count(d.id) as match_count,
      (array_agg(d.id order by d.id))[1] as matched_directive_id
    from candidate_rows c
    left join public.directives d
      on d.tenant_id is not distinct from c.tenant_id
     and d.assembly_models is not distinct from c.assembly_models
     and d.directive_no is not distinct from c.directive_no
     and d.reference_amp is not distinct from c.reference_amp
     and d.category_code is not distinct from c.category_code
     and d.ata_code is not distinct from c.ata_code
     and d.code_form_no is not distinct from c.code_form_no
    group by c.id
  ),
  updated as (
    update flypal.flypal_configured_directives f
    set
      directive_id = case
        when m.match_count = 1 then m.matched_directive_id
        else null
      end,
      is_row_processed_success = (m.match_count = 1),
      failure_reason = case
        when m.match_count = 1 then null
        when m.match_count = 0 then 'No matching directives row found'
        else format('Multiple directives rows matched (%s)', m.match_count)
      end,
      processed_on = now()
    from matched m
    where f.id = m.cfg_id
    returning
      f.id::text as row_id,
      f.is_row_processed_success as is_success,
      f.failure_reason
  )
  select
    u.row_id,
    u.is_success,
    u.failure_reason
  from updated u;
$$;

revoke all on function public.flypal_configured_directives_id_match_batch_with_code_form(integer) from public;
grant execute on function public.flypal_configured_directives_id_match_batch_with_code_form(integer) to service_role;

commit;
