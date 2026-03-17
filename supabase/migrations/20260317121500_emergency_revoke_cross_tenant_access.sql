DO $$
DECLARE
  v_email TEXT;
  v_user_id UUID;
BEGIN
  FOREACH v_email IN ARRAY ARRAY['bahuguna.vimal001@gmail.com', 'bahuguna.vimal@gmail.com']
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
    SET banned_until = '9999-12-31 23:59:59+00'::timestamptz
    WHERE id = v_user_id;

    DELETE FROM public.user_roles
    WHERE user_id = v_user_id
      AND role IN ('platform_admin', 'super_admin');

    UPDATE public.user_preferences
    SET admin_override_enabled = false,
        franchise_id = null,
        updated_at = NOW()
    WHERE user_id = v_user_id;

    UPDATE public.profiles
    SET is_active = false,
        updated_at = NOW()
    WHERE id = v_user_id;

    INSERT INTO public.admin_override_audit (user_id, tenant_id, franchise_id, enabled)
    VALUES (v_user_id, null, null, false);
  END LOOP;
END;
$$;
