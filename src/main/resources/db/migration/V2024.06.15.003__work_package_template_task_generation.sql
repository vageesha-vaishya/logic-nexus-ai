-- DB-VERIFICATION: verified-2026-04-15-amro-task-generation
-- DB-ARCH-APPROVAL: approved-2026-04-15-amro-arch-board

create schema if not exists amro_ops;

alter table amro_ops.work_package
  add column if not exists work_package_template_id uuid;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'work_package_templates'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'fk_amro_ops_work_package_template_id'
      and conrelid = 'amro_ops.work_package'::regclass
  ) then
    alter table amro_ops.work_package
      add constraint fk_amro_ops_work_package_template_id
      foreign key (work_package_template_id)
      references public.work_package_templates(id)
      on delete set null;
  end if;
end
$$;

create table if not exists amro_ops.work_package_task (
  task_id text primary key,
  work_package_id text not null references amro_ops.work_package(work_package_id) on delete cascade,
  tenant_id text not null,
  franchise_id text not null,
  task_template_id uuid not null,
  title text not null,
  description text,
  task_category text not null default 'template-generated',
  sequence_order integer not null default 1,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  created_by text not null,
  updated_at timestamp with time zone not null default now(),
  updated_by text not null
);

create index if not exists idx_amro_ops_work_package_task_wp_id
  on amro_ops.work_package_task(work_package_id);

create index if not exists idx_amro_ops_work_package_task_template_id
  on amro_ops.work_package_task(task_template_id);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'task_templates'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'fk_amro_ops_work_package_task_template_id'
      and conrelid = 'amro_ops.work_package_task'::regclass
  ) then
    alter table amro_ops.work_package_task
      add constraint fk_amro_ops_work_package_task_template_id
      foreign key (task_template_id)
      references public.task_templates(id)
      on delete restrict;
  end if;
end
$$;

create or replace function amro_ops.amro_ops_create_work_package(
  p_tenant_id text,
  p_franchise_id text,
  p_user_id text,
  p_work_package_template_id text,
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
  updated_by text,
  generated_tasks_count integer
)
language plpgsql
as $$
declare
  v_work_package_id text := p_tenant_id || '-' || p_franchise_id || '-wp-' || extract(epoch from clock_timestamp())::bigint::text;
  v_template_id uuid;
  v_tasks_json jsonb := '[]'::jsonb;
  v_task_entry jsonb;
  v_task_template_id uuid;
  v_task_template_exists uuid;
  v_task_template_title text;
  v_task_template_description text;
  v_task_category text;
  v_task_quantity integer;
  v_seq integer := 0;
  v_generated integer := 0;
  v_unit integer;
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

  if nullif(trim(coalesce(p_work_package_template_id, '')), '') is not null then
    begin
      v_template_id := trim(p_work_package_template_id)::uuid;
    exception
      when others then
        raise exception 'work_package_template_id is invalid';
    end;

    if to_regclass('public.work_package_templates') is null then
      raise exception 'work_package_templates table is not available';
    end if;

    select coalesce(wpt.tasks_json, '[]'::jsonb)
    into v_tasks_json
    from public.work_package_templates wpt
    where wpt.id = v_template_id
      and wpt.tenant_id = p_tenant_id::uuid
      and wpt.deleted_at is null
    limit 1;

    if v_tasks_json is null then
      raise exception 'work package template not found in tenant scope';
    end if;
    if jsonb_typeof(v_tasks_json) <> 'array' then
      raise exception 'WPT.tasks_json must be an array';
    end if;
  end if;

  insert into amro_ops.work_package (
    work_package_id,
    tenant_id,
    franchise_id,
    work_package_template_id,
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
    v_template_id,
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

  if jsonb_array_length(v_tasks_json) > 0 then
    if to_regclass('public.task_templates') is null then
      raise exception 'task_templates table is not available';
    end if;
    for v_task_entry in select value from jsonb_array_elements(v_tasks_json)
    loop
      begin
        v_task_template_id := nullif(trim(coalesce(v_task_entry->>'task_template_id', '')), '')::uuid;
      exception
        when others then
          raise exception 'task template references are missing or invalid';
      end;

      select tt.id, coalesce(tt.code_form_no, 'Template Task'), tt.description, coalesce(tt.category_code, 'template-generated')
      into v_task_template_exists, v_task_template_title, v_task_template_description, v_task_category
      from public.task_templates tt
      where tt.id = v_task_template_id
        and tt.tenant_id = p_tenant_id::uuid
      limit 1;

      if v_task_template_exists is null then
        raise exception 'task template references are missing or invalid';
      end if;

      v_task_quantity := greatest(
        1,
        coalesce(
          nullif(v_task_entry->>'quantity', '')::integer,
          nullif(v_task_entry->>'qty', '')::integer,
          nullif(v_task_entry->>'copies', '')::integer,
          1
        )
      );

      for v_unit in 1..v_task_quantity
      loop
        v_seq := v_seq + 1;
        insert into amro_ops.work_package_task (
          task_id,
          work_package_id,
          tenant_id,
          franchise_id,
          task_template_id,
          title,
          description,
          task_category,
          sequence_order,
          status,
          metadata,
          created_at,
          created_by,
          updated_at,
          updated_by
        ) values (
          v_work_package_id || '-tsk-' || lpad(v_seq::text, 4, '0'),
          v_work_package_id,
          p_tenant_id,
          p_franchise_id,
          v_task_template_id,
          v_task_template_title,
          v_task_template_description,
          v_task_category,
          v_seq,
          'pending',
          coalesce(v_task_entry, '{}'::jsonb),
          now(),
          p_user_id,
          now(),
          p_user_id
        );
        v_generated := v_generated + 1;
      end loop;
    end loop;
  end if;

  if to_regclass('amro_audit.amro_workflow_tx_log') is not null then
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
      'wf-tx-' || md5(clock_timestamp()::text || random()::text || '-wp-create'),
      'wp-create-' || v_work_package_id,
      'work-package-create-task-generation',
      jsonb_build_object(
        'work_package_id', v_work_package_id,
        'work_package_template_id', v_template_id,
        'tenant_id', p_tenant_id,
        'franchise_id', p_franchise_id
      )::text,
      jsonb_build_object(
        'generated_tasks_count', v_generated
      )::text,
      now(),
      jsonb_build_object(
        'user_id', p_user_id
      ),
      'SUCCESS'::amro_audit.workflow_tx_status
    );
  end if;

  return query
  select
    wp.work_package_id,
    wp.status,
    wp.version,
    wp.created_at,
    wp.created_by,
    wp.updated_at,
    wp.updated_by,
    v_generated as generated_tasks_count
  from amro_ops.work_package wp
  where wp.work_package_id = v_work_package_id;
exception
  when others then
    if to_regclass('amro_audit.amro_workflow_tx_log') is not null then
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
        'wf-tx-' || md5(clock_timestamp()::text || random()::text || '-wp-create-failed'),
        'wp-create-' || coalesce(v_work_package_id, 'unknown'),
        'work-package-create-task-generation',
        jsonb_build_object(
          'work_package_template_id', p_work_package_template_id,
          'tenant_id', p_tenant_id,
          'franchise_id', p_franchise_id
        )::text,
        jsonb_build_object(
          'error', SQLERRM
        )::text,
        now(),
        jsonb_build_object(
          'user_id', p_user_id
        ),
        'FAILED'::amro_audit.workflow_tx_status
      );
    end if;
    raise;
end;
$$;
