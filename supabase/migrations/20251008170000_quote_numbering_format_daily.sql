-- Implement required quote number format: PREFIX-YYMMDD-##### (daily reset)
-- Also updates preview function to reflect the same format

BEGIN;

-- Generator: PREFIX-YYMMDD-##### with tenant/franchise scope and daily reset
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
  -- Prefer franchise config, fallback to tenant
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM public.quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;
  END IF;

  IF v_prefix IS NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM public.quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;

  v_prefix := COALESCE(v_prefix, 'QUO');
  -- Force daily reset to meet requested format
  v_reset_policy := 'daily'::quote_reset_policy;

  -- Period key for sequences: canonical YYYY-MM-DD bucket
  v_period_key := to_char(CURRENT_DATE, 'YYYY-MM-DD');

  -- Upsert/increment sequence per scope
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

  -- Format: PREFIX-YYMMDD-#####
  v_quote_number := v_prefix || '-' || to_char(CURRENT_DATE, 'YYMMDD') || '-' || lpad(v_next_seq::TEXT, 5, '0');

  RETURN v_quote_number;
END;
$$;

-- Preview next without incrementing the sequence
CREATE OR REPLACE FUNCTION public.preview_next_quote_number(
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
  v_period_key TEXT := to_char(CURRENT_DATE, 'YYYY-MM-DD');
  v_next_seq INTEGER := 1;
  v_quote_number TEXT;
BEGIN
  -- Prefer franchise config, fallback to tenant
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix INTO v_prefix
    FROM public.quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;
  END IF;

  IF v_prefix IS NULL THEN
    SELECT prefix INTO v_prefix
    FROM public.quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;

  v_prefix := COALESCE(v_prefix, 'QUO');

  -- Determine next sequence without updating
  IF p_franchise_id IS NOT NULL THEN
    SELECT COALESCE(last_sequence + 1, 1) INTO v_next_seq
    FROM public.quote_number_sequences
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id AND period_key = v_period_key;
  ELSE
    SELECT COALESCE(last_sequence + 1, 1) INTO v_next_seq
    FROM public.quote_number_sequences
    WHERE tenant_id = p_tenant_id AND franchise_id IS NULL AND period_key = v_period_key;
  END IF;

  -- Format: PREFIX-YYMMDD-#####
  v_quote_number := v_prefix || '-' || to_char(CURRENT_DATE, 'YYMMDD') || '-' || lpad(v_next_seq::TEXT, 5, '0');
  RETURN v_quote_number;
END;
$$;

COMMIT;