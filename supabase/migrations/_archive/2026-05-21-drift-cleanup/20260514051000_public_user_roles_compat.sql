-- DB-VERIFICATION:
-- DB-ARCH-APPROVAL:

DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    RETURN;
  END IF;

  IF to_regclass('module_shared.module_shared_user_roles') IS NULL THEN
    RAISE EXCEPTION 'public.user_roles does not exist and module_shared.module_shared_user_roles not found';
  END IF;

  EXECUTE $sql$
    CREATE TABLE public.user_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      role public.app_role NOT NULL,
      tenant_id UUID NULL,
      franchise_id UUID NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  $sql$;

  EXECUTE $sql$
    CREATE UNIQUE INDEX user_roles_user_role_scope_uk
    ON public.user_roles (user_id, role, tenant_id, franchise_id)
  $sql$;

  EXECUTE $sql$
    INSERT INTO public.user_roles (user_id, role, tenant_id, franchise_id, created_at, updated_at)
    SELECT
      user_id,
      (role::text)::public.app_role,
      tenant_id,
      franchise_id,
      COALESCE(created_at, now()),
      COALESCE(updated_at, now())
    FROM module_shared.module_shared_user_roles
  $sql$;
END $$;

