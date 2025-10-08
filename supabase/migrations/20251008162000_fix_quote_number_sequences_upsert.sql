-- Fix quote number generation upsert logic and unique indexes
-- - Adds partial unique indexes for tenant/franchise sequences
-- - Replaces generate_quote_number to use valid ON CONFLICT targets

BEGIN;

-- Ensure partial unique indexes exist to enforce one row per period
-- Tenant-level (franchise_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_quote_number_sequences_tenant_period
  ON public.quote_number_sequences (tenant_id, period_key)
  WHERE franchise_id IS NULL;

-- Franchise-level (franchise_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_quote_number_sequences_franchise_period
  ON public.quote_number_sequences (tenant_id, franchise_id, period_key)
  WHERE franchise_id IS NOT NULL;

-- Replace generator function to upsert using the above indexes
CREATE OR REPLACE FUNCTION public.generate_quote_number(
  p_tenant_id uuid,
  p_franchise_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_reset_policy quote_reset_policy;
  v_period_key TEXT;
  v_next_seq INTEGER;
  v_quote_number TEXT;
BEGIN
  -- Get configuration (franchise overrides tenant)
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM public.quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;
  END IF;

  -- Fall back to tenant config if no franchise config
  IF v_prefix IS NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM public.quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;

  -- Defaults if no config exists
  v_prefix := COALESCE(v_prefix, 'QUO');
  v_reset_policy := COALESCE(v_reset_policy, 'none'::quote_reset_policy);

  -- Determine period key
  v_period_key := CASE v_reset_policy
    WHEN 'daily' THEN to_char(CURRENT_DATE, 'YYYY-MM-DD')
    WHEN 'monthly' THEN to_char(CURRENT_DATE, 'YYYY-MM')
    WHEN 'yearly' THEN to_char(CURRENT_DATE, 'YYYY')
    ELSE 'none'
  END;

  -- Upsert into sequences and fetch next value
  IF p_franchise_id IS NOT NULL THEN
    INSERT INTO public.quote_number_sequences (tenant_id, franchise_id, period_key, last_sequence)
    VALUES (p_tenant_id, p_franchise_id, v_period_key, 1)
    ON CONFLICT (tenant_id, franchise_id, period_key)
    DO UPDATE SET last_sequence = public.quote_number_sequences.last_sequence + 1,
                  updated_at = NOW()
    RETURNING last_sequence INTO v_next_seq;
  ELSE
    INSERT INTO public.quote_number_sequences (tenant_id, franchise_id, period_key, last_sequence)
    VALUES (p_tenant_id, NULL, v_period_key, 1)
    ON CONFLICT (tenant_id, period_key)
    DO UPDATE SET last_sequence = public.quote_number_sequences.last_sequence + 1,
                  updated_at = NOW()
    RETURNING last_sequence INTO v_next_seq;
  END IF;

  -- Build final quote number string
  v_quote_number := CASE v_reset_policy
    WHEN 'daily' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    WHEN 'monthly' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    WHEN 'yearly' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    ELSE v_prefix || '-' || lpad(v_next_seq::TEXT, 6, '0')
  END;

  RETURN v_quote_number;
END;
$$;

COMMIT;