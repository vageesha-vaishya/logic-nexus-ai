ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

CREATE UNIQUE INDEX IF NOT EXISTS system_settings_global_setting_key_unique
  ON public.system_settings (setting_key)
  WHERE tenant_id IS NULL;

DO $$
BEGIN
  IF to_regclass('public.platform_system_config') IS NOT NULL THEN
    INSERT INTO public.system_settings (tenant_id, setting_key, setting_value, updated_at, updated_by)
    SELECT
      NULL,
      setting_key,
      setting_value,
      updated_at,
      updated_by
    FROM public.platform_system_config
    ON CONFLICT (setting_key) WHERE tenant_id IS NULL
    DO UPDATE SET
      setting_value = EXCLUDED.setting_value,
      updated_at = EXCLUDED.updated_at,
      updated_by = EXCLUDED.updated_by;

    DROP TABLE public.platform_system_config;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_platform_debug_button_enabled()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN := false;
BEGIN
  SELECT COALESCE((setting_value ->> 'enabled')::BOOLEAN, false)
  INTO v_enabled
  FROM public.system_settings
  WHERE tenant_id IS NULL
    AND setting_key = 'header_debug_button'
  ORDER BY updated_at DESC
  LIMIT 1;

  RETURN COALESCE(v_enabled, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_platform_debug_button_enabled(
  p_enabled BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_platform_admin BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT public.is_platform_admin(v_user_id) INTO v_is_platform_admin;
  IF NOT v_is_platform_admin THEN
    RAISE EXCEPTION 'Platform admin privileges required';
  END IF;

  INSERT INTO public.system_settings (tenant_id, setting_key, setting_value, updated_at, updated_by)
  VALUES (
    NULL,
    'header_debug_button',
    jsonb_build_object('enabled', p_enabled),
    now(),
    v_user_id
  )
  ON CONFLICT (setting_key) WHERE tenant_id IS NULL
  DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    updated_at = now(),
    updated_by = v_user_id;

  INSERT INTO public.app_feature_flags (flag_key, is_enabled, description)
  VALUES (
    'header_debug_button',
    p_enabled,
    'Controls platform admin visibility of Banner Header debug button'
  )
  ON CONFLICT (flag_key)
  DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled,
    description = EXCLUDED.description;

  INSERT INTO public.audit_logs (user_id, action, resource_type, details)
  VALUES (
    v_user_id,
    'debug_button_setting_updated',
    'debug_security',
    jsonb_build_object(
      'enabled', p_enabled,
      'reason', COALESCE(p_reason, ''),
      'setting_key', 'header_debug_button'
    )
  );

  RETURN p_enabled;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_debug_access_attempt(
  p_action TEXT DEFAULT 'open_dashboard'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_platform_admin BOOLEAN := false;
  v_enabled BOOLEAN := false;
  v_attempt_count INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT public.is_platform_admin(v_user_id) INTO v_is_platform_admin;
  SELECT public.get_platform_debug_button_enabled() INTO v_enabled;

  SELECT COUNT(*)
  INTO v_attempt_count
  FROM public.audit_logs
  WHERE user_id = v_user_id
    AND resource_type = 'debug_security'
    AND action = 'debug_access_attempt'
    AND created_at >= now() - interval '1 minute';

  IF v_attempt_count >= 20 THEN
    INSERT INTO public.audit_logs (user_id, action, resource_type, details)
    VALUES (
      v_user_id,
      'debug_access_rate_limited',
      'debug_security',
      jsonb_build_object('action', p_action, 'count', v_attempt_count)
    );
    RETURN false;
  END IF;

  IF NOT v_is_platform_admin OR NOT v_enabled THEN
    INSERT INTO public.audit_logs (user_id, action, resource_type, details)
    VALUES (
      v_user_id,
      'debug_access_denied',
      'debug_security',
      jsonb_build_object(
        'action', p_action,
        'is_platform_admin', v_is_platform_admin,
        'is_enabled', v_enabled
      )
    );
    RETURN false;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, resource_type, details)
  VALUES (
    v_user_id,
    'debug_access_attempt',
    'debug_security',
    jsonb_build_object('action', p_action)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_debug_button_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_platform_debug_button_enabled(BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_debug_access_attempt(TEXT) TO authenticated;
