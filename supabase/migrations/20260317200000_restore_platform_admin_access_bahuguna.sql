DO $$
DECLARE
  v_email TEXT;
  v_user_id UUID;
BEGIN
  FOREACH v_email IN ARRAY ARRAY['bahuguna.vimal@gmail.com', 'bashuguna.vimal@gmail.com']
  LOOP
    SELECT id
    INTO v_user_id
    FROM auth.users
    WHERE LOWER(email) = LOWER(v_email)
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_user_id IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE auth.users
    SET banned_until = NULL,
        updated_at = NOW()
    WHERE id = v_user_id;

    INSERT INTO public.profiles (id, email, is_active, must_change_password, updated_at)
    VALUES (v_user_id, v_email, true, false, NOW())
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          is_active = true,
          updated_at = NOW();

    DELETE FROM public.user_roles
    WHERE user_id = v_user_id
      AND role = 'platform_admin'::public.app_role
      AND (tenant_id IS NOT NULL OR franchise_id IS NOT NULL);

    INSERT INTO public.user_roles (user_id, role, tenant_id, franchise_id, assigned_by)
    SELECT v_user_id, 'platform_admin'::public.app_role, NULL, NULL, v_user_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = v_user_id
        AND role = 'platform_admin'::public.app_role
        AND tenant_id IS NULL
        AND franchise_id IS NULL
    );

    INSERT INTO public.admin_override_audit (user_id, tenant_id, franchise_id, enabled)
    VALUES (v_user_id, NULL, NULL, false);

    INSERT INTO public.audit_logs (user_id, action, resource_type, details)
    VALUES (
      v_user_id,
      'platform_admin_access_restored',
      'auth_user',
      jsonb_build_object('email', LOWER(v_email), 'restored_at', NOW())
    );
  END LOOP;
END;
$$;
