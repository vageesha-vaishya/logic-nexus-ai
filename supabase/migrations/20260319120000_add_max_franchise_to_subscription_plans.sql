DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscription_plans'
      AND column_name = 'max_franchise'
  ) THEN
    ALTER TABLE public.subscription_plans
      ADD COLUMN max_franchise INTEGER;
  END IF;
END $$;

COMMENT ON COLUMN public.subscription_plans.max_franchise IS 'Maximum franchises allowed for this plan (NULL = unlimited)';
