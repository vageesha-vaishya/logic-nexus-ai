-- Seed a Platform Admin user role for a specific email.
-- Idempotent: safely creates/updates profile and user_roles once the auth user exists.
-- NOTE: Creating an auth user with a password cannot be done via SQL.
--       First add the user in Supabase Dashboard (Auth > Users) with the password.

DO $$
DECLARE
  target_email TEXT := 'Bahuguna.vimal@gmail.com';
  v_user_id UUID;
BEGIN
  SELECT u.id INTO v_user_id
  FROM auth.users u
  WHERE lower(u.email) = lower(target_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Auth user % not found. Create it via Dashboard with the specified password, then re-run this script.', target_email;
    RETURN;
  END IF;

  -- Ensure profile exists and is active
  INSERT INTO public.profiles (id, email, is_active, must_change_password)
  VALUES (v_user_id, target_email, TRUE, FALSE)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        is_active = TRUE,
        updated_at = now();

  -- Grant platform_admin role (global; no tenant/franchise scope)
  INSERT INTO public.user_roles (user_id, role, tenant_id, franchise_id, assigned_by)
  VALUES (v_user_id, 'platform_admin'::public.app_role, NULL, NULL, v_user_id)
  ON CONFLICT (user_id, role, tenant_id, franchise_id) DO UPDATE
    SET assigned_at = now(),
        assigned_by = COALESCE(public.user_roles.assigned_by, v_user_id);

  RAISE NOTICE 'Platform admin seeded for % (user_id=%).', target_email, v_user_id;
END $$;

-- Quick verification helpers:
-- SELECT public.is_platform_admin(v_user_id) AS is_admin;
-- SELECT * FROM public.user_roles WHERE user_id = v_user_id;
-- SELECT * FROM public.profiles WHERE id = v_user_id;