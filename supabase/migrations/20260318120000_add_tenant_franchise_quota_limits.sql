DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'max_franchises'
  ) THEN
    ALTER TABLE public.tenants
      ADD COLUMN max_franchises INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'max_users'
  ) THEN
    ALTER TABLE public.tenants
      ADD COLUMN max_users INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'franchises'
      AND column_name = 'user_limit'
  ) THEN
    ALTER TABLE public.franchises
      ADD COLUMN user_limit INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  UPDATE public.tenants
    SET max_franchises = 0
    WHERE max_franchises < 0 OR max_franchises IS NULL;

  UPDATE public.tenants
    SET max_users = 0
    WHERE max_users < 0 OR max_users IS NULL;

  UPDATE public.franchises
    SET user_limit = 0
    WHERE user_limit < 0 OR user_limit IS NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'max_franchises'
  ) THEN
    ALTER TABLE public.tenants
      ALTER COLUMN max_franchises SET DEFAULT 0,
      ALTER COLUMN max_franchises SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'max_users'
  ) THEN
    ALTER TABLE public.tenants
      ALTER COLUMN max_users SET DEFAULT 0,
      ALTER COLUMN max_users SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'franchises'
      AND column_name = 'user_limit'
  ) THEN
    ALTER TABLE public.franchises
      ALTER COLUMN user_limit SET DEFAULT 0,
      ALTER COLUMN user_limit SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenants_max_franchises_non_negative'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_max_franchises_non_negative
      CHECK (max_franchises IS NULL OR max_franchises >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenants_max_users_non_negative'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_max_users_non_negative
      CHECK (max_users IS NULL OR max_users >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'franchises_user_limit_non_negative'
  ) THEN
    ALTER TABLE public.franchises
      ADD CONSTRAINT franchises_user_limit_non_negative
      CHECK (user_limit IS NULL OR user_limit >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.tenants.max_franchises IS 'Maximum number of franchises allowed per tenant. 0 means unlimited.';
COMMENT ON COLUMN public.tenants.max_users IS 'Maximum number of direct users allowed per tenant. 0 means unlimited.';
COMMENT ON COLUMN public.franchises.user_limit IS 'Maximum number of users allowed per franchise. 0 means unlimited.';

DO $$
BEGIN
  IF current_setting('app.migration_direction', true) = 'down' THEN
    ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_max_franchises_non_negative;
    ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_max_users_non_negative;
    ALTER TABLE public.franchises DROP CONSTRAINT IF EXISTS franchises_user_limit_non_negative;
    ALTER TABLE public.tenants DROP COLUMN IF EXISTS max_franchises;
    ALTER TABLE public.tenants DROP COLUMN IF EXISTS max_users;
    ALTER TABLE public.franchises DROP COLUMN IF EXISTS user_limit;
  END IF;
END $$;
