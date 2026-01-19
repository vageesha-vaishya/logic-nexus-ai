-- Subscription Plan Enhancements for Master Data Management
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscription_plans'
      AND column_name = 'price_quarterly'
  ) THEN
    ALTER TABLE public.subscription_plans
      ADD COLUMN price_quarterly NUMERIC(12,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscription_plans'
      AND column_name = 'trial_period_days'
  ) THEN
    ALTER TABLE public.subscription_plans
      ADD COLUMN trial_period_days INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscription_plans'
      AND column_name = 'deployment_model'
  ) THEN
    ALTER TABLE public.subscription_plans
      ADD COLUMN deployment_model TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscription_plans'
      AND column_name = 'supported_currencies'
  ) THEN
    ALTER TABLE public.subscription_plans
      ADD COLUMN supported_currencies TEXT[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscription_plans'
      AND column_name = 'supported_languages'
  ) THEN
    ALTER TABLE public.subscription_plans
      ADD COLUMN supported_languages TEXT[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscription_plans'
      AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.subscription_plans
      ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END$$;

