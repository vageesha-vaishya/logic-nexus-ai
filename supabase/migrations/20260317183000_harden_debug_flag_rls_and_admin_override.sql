begin;

create or replace function public.is_actual_platform_admin(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = check_user_id
      and role = 'platform_admin'
  );
$$;

drop policy if exists app_feature_flags_write_platform_admin on public.app_feature_flags;
create policy app_feature_flags_write_platform_admin
on public.app_feature_flags
for all
to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.is_actual_platform_admin(auth.uid())
)
with check (
  public.is_platform_admin(auth.uid())
  or public.is_actual_platform_admin(auth.uid())
);

create or replace function public.set_platform_debug_button_enabled(
  p_enabled boolean,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_platform_admin boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select public.is_actual_platform_admin(v_user_id) into v_is_platform_admin;
  if not v_is_platform_admin then
    raise exception 'Platform admin privileges required';
  end if;

  insert into public.system_settings (tenant_id, setting_key, setting_value, updated_at, updated_by)
  values (
    null,
    'header_debug_button',
    jsonb_build_object('enabled', p_enabled),
    now(),
    v_user_id
  )
  on conflict (setting_key) where tenant_id is null
  do update set
    setting_value = excluded.setting_value,
    updated_at = now(),
    updated_by = v_user_id;

  insert into public.app_feature_flags (flag_key, is_enabled, description)
  values (
    'header_debug_button',
    p_enabled,
    'Controls platform admin visibility of Banner Header debug button'
  )
  on conflict (flag_key)
  do update set
    is_enabled = excluded.is_enabled,
    description = excluded.description;

  insert into public.audit_logs (user_id, action, resource_type, details)
  values (
    v_user_id,
    'debug_button_setting_updated',
    'debug_security',
    jsonb_build_object(
      'enabled', p_enabled,
      'reason', coalesce(p_reason, ''),
      'setting_key', 'header_debug_button'
    )
  );

  return p_enabled;
end;
$$;

create or replace function public.validate_debug_access_attempt(
  p_action text default 'open_dashboard'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_platform_admin boolean := false;
  v_enabled boolean := false;
  v_attempt_count integer := 0;
begin
  if v_user_id is null then
    return false;
  end if;

  select public.is_actual_platform_admin(v_user_id) into v_is_platform_admin;
  select public.get_platform_debug_button_enabled() into v_enabled;

  select count(*)
  into v_attempt_count
  from public.audit_logs
  where user_id = v_user_id
    and resource_type = 'debug_security'
    and action = 'debug_access_attempt'
    and created_at >= now() - interval '1 minute';

  if v_attempt_count >= 20 then
    insert into public.audit_logs (user_id, action, resource_type, details)
    values (
      v_user_id,
      'debug_access_rate_limited',
      'debug_security',
      jsonb_build_object('action', p_action, 'count', v_attempt_count)
    );
    return false;
  end if;

  if not v_is_platform_admin or not v_enabled then
    insert into public.audit_logs (user_id, action, resource_type, details)
    values (
      v_user_id,
      'debug_access_denied',
      'debug_security',
      jsonb_build_object(
        'action', p_action,
        'is_platform_admin', v_is_platform_admin,
        'is_enabled', v_enabled
      )
    );
    return false;
  end if;

  insert into public.audit_logs (user_id, action, resource_type, details)
  values (
    v_user_id,
    'debug_access_attempt',
    'debug_security',
    jsonb_build_object('action', p_action)
  );

  return true;
end;
$$;

grant execute on function public.set_platform_debug_button_enabled(boolean, text) to authenticated;
grant execute on function public.validate_debug_access_attempt(text) to authenticated;

commit;
