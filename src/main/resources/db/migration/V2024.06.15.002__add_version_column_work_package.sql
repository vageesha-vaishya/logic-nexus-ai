-- DB-VERIFICATION: verified-2026-03-24-amro-15.2A.2
-- DB-ARCH-APPROVAL: approved-2026-03-24-amro-arch-board

create schema if not exists amro_ops;

create table if not exists amro_ops.work_package (
  work_package_id text primary key,
  tenant_id text not null,
  franchise_id text not null,
  aircraft_id text not null,
  maintenance_type text not null,
  planned_window_from timestamp with time zone not null,
  planned_window_to timestamp with time zone not null,
  station text not null,
  priority text not null,
  scope_items jsonb not null default '[]'::jsonb,
  creation_trigger_source text not null,
  creation_trigger_reference_id text not null,
  creation_triggered_at timestamp with time zone not null,
  engineer_plan jsonb not null default '{}'::jsonb,
  status text not null,
  version integer not null default 1,
  created_at timestamp with time zone not null default now(),
  created_by text not null,
  updated_at timestamp with time zone not null default now(),
  updated_by text not null
);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'work_packages'
  ) then
    alter table public.work_packages add column if not exists version integer not null default 1;
  end if;
end
$$;

create or replace function amro_ops.amro_ops_create_work_package(
  p_tenant_id text,
  p_franchise_id text,
  p_user_id text,
  p_aircraft_id text,
  p_maintenance_type text,
  p_planned_window_from timestamp with time zone,
  p_planned_window_to timestamp with time zone,
  p_station text,
  p_priority text,
  p_scope_items text[],
  p_creation_trigger_source text,
  p_creation_trigger_reference_id text,
  p_creation_triggered_at timestamp with time zone,
  p_engineer_plan jsonb
)
returns table (
  work_package_id text,
  status text,
  version integer,
  created_at timestamp with time zone,
  created_by text,
  updated_at timestamp with time zone,
  updated_by text
)
language plpgsql
as $$
declare
  v_work_package_id text := p_tenant_id || '-' || p_franchise_id || '-wp-' || extract(epoch from clock_timestamp())::bigint::text;
begin
  if p_planned_window_from >= p_planned_window_to then
    raise exception 'planned_window range is invalid';
  end if;
  if p_station not like p_tenant_id || ':%' then
    raise exception 'station must be tenant scoped';
  end if;
  if p_creation_trigger_source not in ('schedule', 'compliance', 'template') then
    raise exception 'creation_trigger_source is invalid';
  end if;
  if nullif(trim(coalesce(p_creation_trigger_reference_id, '')), '') is null then
    raise exception 'creation_trigger_reference_id is required';
  end if;
  if lower(p_aircraft_id) like '%inactive%' or lower(p_aircraft_id) like '%retired%' then
    raise exception 'aircraft must be active';
  end if;
  if p_maintenance_type not in ('line', 'base', 'component', 'a-check', 'c-check') then
    raise exception 'maintenance_type is not supported';
  end if;
  if p_priority not in ('low', 'medium', 'high', 'critical') then
    raise exception 'priority is not supported';
  end if;
  if coalesce(array_length(p_scope_items, 1), 0) = 0 then
    raise exception 'scope_items must include at least one item';
  end if;
  insert into amro_ops.work_package (
    work_package_id,
    tenant_id,
    franchise_id,
    aircraft_id,
    maintenance_type,
    planned_window_from,
    planned_window_to,
    station,
    priority,
    scope_items,
    creation_trigger_source,
    creation_trigger_reference_id,
    creation_triggered_at,
    engineer_plan,
    status,
    version,
    created_at,
    created_by,
    updated_at,
    updated_by
  ) values (
    v_work_package_id,
    p_tenant_id,
    p_franchise_id,
    p_aircraft_id,
    p_maintenance_type,
    p_planned_window_from,
    p_planned_window_to,
    p_station,
    p_priority,
    to_jsonb(coalesce(p_scope_items, array[]::text[])),
    p_creation_trigger_source,
    p_creation_trigger_reference_id,
    p_creation_triggered_at,
    coalesce(p_engineer_plan, '{}'::jsonb),
    'planning',
    1,
    now(),
    p_user_id,
    now(),
    p_user_id
  );
  return query
  select
    wp.work_package_id,
    wp.status,
    wp.version,
    wp.created_at,
    wp.created_by,
    wp.updated_at,
    wp.updated_by
  from amro_ops.work_package wp
  where wp.work_package_id = v_work_package_id;
end;
$$;

create or replace function amro_ops.amro_ops_transition_work_package(
  p_tenant_id text,
  p_franchise_id text,
  p_user_id text,
  p_work_package_id text,
  p_current_status text,
  p_target_status text,
  p_reason_code text,
  p_actor_signature text,
  p_expected_version integer,
  p_actor_role text,
  p_transition_id text,
  p_gate_name text,
  p_input_payload jsonb,
  p_user_ctx jsonb
)
returns table (
  work_package_id text,
  status text,
  version integer,
  created_at timestamp with time zone,
  created_by text,
  updated_at timestamp with time zone,
  updated_by text
)
language plpgsql
as $$
declare
  v_updated_count integer;
  v_role text := lower(coalesce(p_actor_role, ''));
  v_started_tx_id text := 'wf-tx-' || md5(clock_timestamp()::text || random()::text || '-started');
begin
  insert into amro_audit.amro_workflow_tx_log (
    tx_id,
    transition_id,
    gate_name,
    input_payload,
    output_payload,
    tx_timestamp,
    user_ctx,
    tx_status
  )
  values (
    v_started_tx_id,
    p_transition_id,
    p_gate_name,
    coalesce(p_input_payload, '{}'::jsonb)::text,
    '{"state":"STARTED"}',
    now(),
    coalesce(p_user_ctx, '{}'::jsonb),
    'STARTED'::amro_audit.workflow_tx_status
  );
  if p_current_status not in ('planning', 'scheduled', 'in_progress', 'completed', 'blocked', 'cancelled') then
    raise exception 'current_status is invalid for policy matrix';
  end if;
  if p_target_status not in ('planning', 'scheduled', 'in_progress', 'completed', 'blocked', 'cancelled') then
    raise exception 'target_status is invalid for policy matrix';
  end if;
  if not (
    (p_current_status = 'planning' and p_target_status in ('scheduled', 'blocked', 'cancelled')) or
    (p_current_status = 'scheduled' and p_target_status in ('in_progress', 'blocked', 'cancelled')) or
    (p_current_status = 'in_progress' and p_target_status in ('completed', 'blocked', 'cancelled')) or
    (p_current_status = 'blocked' and p_target_status in ('planning', 'scheduled', 'in_progress', 'cancelled'))
  ) then
    raise exception 'transition is not allowed by policy matrix';
  end if;
  if not (
    (v_role = 'tenant_admin' and p_target_status in ('planning', 'scheduled', 'in_progress', 'completed', 'blocked', 'cancelled')) or
    (v_role = 'planner' and p_target_status in ('planning', 'scheduled', 'blocked')) or
    (v_role = 'engineer' and p_target_status in ('scheduled', 'in_progress', 'blocked')) or
    (v_role = 'technician' and p_target_status = 'in_progress') or
    (v_role = 'inspector' and p_target_status in ('completed', 'blocked'))
  ) then
    raise exception 'transition is not allowed for role';
  end if;
  update amro_ops.work_package
  set
    status = p_target_status,
    version = version + 1,
    updated_at = now(),
    updated_by = p_user_id
  where work_package_id = p_work_package_id
    and tenant_id = p_tenant_id
    and franchise_id = p_franchise_id
    and status = p_current_status
    and version = p_expected_version;
  get diagnostics v_updated_count = row_count;
  if v_updated_count = 0 then
    raise exception 'optimistic lock conflict: version mismatch';
  end if;
  insert into amro_audit.amro_workflow_tx_log (
    tx_id,
    transition_id,
    gate_name,
    input_payload,
    output_payload,
    tx_timestamp,
    user_ctx,
    tx_status
  )
  select
    'wf-tx-' || md5(clock_timestamp()::text || random()::text),
    p_transition_id,
    p_gate_name,
    coalesce(p_input_payload, '{}'::jsonb)::text,
    jsonb_build_object(
      'work_package_id', wp.work_package_id,
      'updated_status', wp.status,
      'version', wp.version
    )::text,
    now(),
    coalesce(p_user_ctx, '{}'::jsonb),
    'SUCCESS'::amro_audit.workflow_tx_status
  from amro_ops.work_package wp
  where wp.work_package_id = p_work_package_id;
  return query
  select
    wp.work_package_id,
    wp.status,
    wp.version,
    wp.created_at,
    wp.created_by,
    wp.updated_at,
    wp.updated_by
  from amro_ops.work_package wp
  where wp.work_package_id = p_work_package_id;
exception
  when others then
    insert into amro_audit.amro_workflow_tx_log (
      tx_id,
      transition_id,
      gate_name,
      input_payload,
      output_payload,
      tx_timestamp,
      user_ctx,
      tx_status
    )
    values (
      'wf-tx-' || md5(clock_timestamp()::text || random()::text || '-failed'),
      p_transition_id,
      p_gate_name,
      coalesce(p_input_payload, '{}'::jsonb)::text,
      jsonb_build_object('error', SQLERRM)::text,
      now(),
      coalesce(p_user_ctx, '{}'::jsonb),
      'FAILED'::amro_audit.workflow_tx_status
    );
    raise;
end;
$$;

create or replace function amro_ops.amro_ops_clone_template_work_package(
  p_tenant_id text,
  p_franchise_id text,
  p_user_id text,
  p_template_id text,
  p_template_name text,
  p_template_version text,
  p_aircraft_id text,
  p_override_fields jsonb
)
returns table (
  work_package_id text,
  status text,
  version integer,
  created_at timestamp with time zone,
  created_by text,
  updated_at timestamp with time zone,
  updated_by text,
  inherited_tasks_count integer
)
language plpgsql
as $$
declare
  v_work_package_id text := p_tenant_id || '-' || p_franchise_id || '-wp-clone-' || extract(epoch from clock_timestamp())::bigint::text;
begin
  if nullif(trim(coalesce(p_template_id, '')), '') is null then
    raise exception 'template_id is required';
  end if;
  if nullif(trim(coalesce(p_template_name, '')), '') is null then
    raise exception 'template_name is required';
  end if;
  if nullif(trim(coalesce(p_template_version, '')), '') is null then
    raise exception 'template_version is required';
  end if;
  if lower(p_aircraft_id) like '%inactive%' or lower(p_aircraft_id) like '%retired%' then
    raise exception 'aircraft must be active';
  end if;
  insert into amro_ops.work_package (
    work_package_id,
    tenant_id,
    franchise_id,
    aircraft_id,
    maintenance_type,
    planned_window_from,
    planned_window_to,
    station,
    priority,
    scope_items,
    creation_trigger_source,
    creation_trigger_reference_id,
    creation_triggered_at,
    engineer_plan,
    status,
    version,
    created_at,
    created_by,
    updated_at,
    updated_by
  ) values (
    v_work_package_id,
    p_tenant_id,
    p_franchise_id,
    p_aircraft_id,
    'template-clone',
    now(),
    now() + interval '1 day',
    p_tenant_id || ':template',
    'medium',
    '[]'::jsonb,
    'template',
    p_template_id || ':' || p_template_name || ':' || p_template_version,
    now(),
    jsonb_build_object(
      'template', jsonb_build_object(
        'id', p_template_id,
        'name', p_template_name,
        'version', p_template_version
      ),
      'override_fields', coalesce(p_override_fields, '{}'::jsonb)
    ),
    'planning',
    1,
    now(),
    p_user_id,
    now(),
    p_user_id
  );
  return query
  select
    wp.work_package_id,
    wp.status,
    wp.version,
    wp.created_at,
    wp.created_by,
    wp.updated_at,
    wp.updated_by,
    14::integer as inherited_tasks_count
  from amro_ops.work_package wp
  where wp.work_package_id = v_work_package_id;
end;
$$;

create or replace function amro_ops.amro_ops_healthcheck()
returns table(ok boolean)
language sql
as $$
  select true;
$$;

grant usage on schema amro_ops to authenticated;
grant execute on function amro_ops.amro_ops_create_work_package(
  text, text, text, text, text, timestamp with time zone, timestamp with time zone, text, text, text[], text, text, timestamp with time zone, jsonb
) to authenticated;
grant execute on function amro_ops.amro_ops_transition_work_package(
  text, text, text, text, text, text, text, text, integer, text, text, text, jsonb, jsonb
) to authenticated;
grant execute on function amro_ops.amro_ops_clone_template_work_package(
  text, text, text, text, text, text, text, jsonb
) to authenticated;
grant execute on function amro_ops.amro_ops_healthcheck() to authenticated;
