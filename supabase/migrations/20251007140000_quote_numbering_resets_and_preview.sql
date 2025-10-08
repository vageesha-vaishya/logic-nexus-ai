-- Extend quote numbering with reset policies and preview RPC

-- Add reset policy to config tables
ALTER TABLE IF EXISTS public.quote_number_config_tenant
  ADD COLUMN IF NOT EXISTS reset_policy text NOT NULL DEFAULT 'none',
  ADD CONSTRAINT quote_number_config_tenant_reset_policy_chk CHECK (reset_policy IN ('none','daily','monthly','yearly'));

ALTER TABLE IF EXISTS public.quote_number_config_franchise
  ADD COLUMN IF NOT EXISTS reset_policy text NOT NULL DEFAULT 'none',
  ADD CONSTRAINT quote_number_config_franchise_reset_policy_chk CHECK (reset_policy IN ('none','daily','monthly','yearly'));

-- Add last reset bucket to sequences
ALTER TABLE IF EXISTS public.quote_sequences_tenant
  ADD COLUMN IF NOT EXISTS last_reset_bucket text;

ALTER TABLE IF EXISTS public.quote_sequences_franchise
  ADD COLUMN IF NOT EXISTS last_reset_bucket text;

-- Helper function: current bucket based on reset policy
CREATE OR REPLACE FUNCTION public._current_reset_bucket(p_policy text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_bucket text;
BEGIN
  IF p_policy = 'daily' THEN
    v_bucket := to_char((now() at time zone 'UTC'), 'YYYYMMDD');
  ELSIF p_policy = 'monthly' THEN
    v_bucket := to_char((now() at time zone 'UTC'), 'YYYYMM');
  ELSIF p_policy = 'yearly' THEN
    v_bucket := to_char((now() at time zone 'UTC'), 'YYYY');
  ELSE
    v_bucket := 'none';
  END IF;
  RETURN v_bucket;
END;
$$;

-- Replace generator to respect reset policy
CREATE OR REPLACE FUNCTION public.generate_quote_number(p_tenant_id uuid, p_franchise_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_policy text := 'none';
  v_bucket text;
  v_seq bigint;
  v_date text;
BEGIN
  -- Determine prefix and reset policy
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_policy
    FROM public.quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;

    IF v_prefix IS NULL THEN
      SELECT prefix, reset_policy INTO v_prefix, v_policy
      FROM public.quote_number_config_tenant
      WHERE tenant_id = p_tenant_id;
    END IF;
  ELSE
    SELECT prefix, reset_policy INTO v_prefix, v_policy
    FROM public.quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;

  IF v_prefix IS NULL THEN v_prefix := 'QUO'; END IF;
  IF v_policy IS NULL THEN v_policy := 'none'; END IF;

  v_bucket := public._current_reset_bucket(v_policy);

  -- Acquire next sequence with reset handling
  IF p_franchise_id IS NOT NULL THEN
    INSERT INTO public.quote_sequences_franchise (tenant_id, franchise_id, seq_value, last_reset_bucket)
    VALUES (p_tenant_id, p_franchise_id, 1, v_bucket)
    ON CONFLICT (tenant_id, franchise_id)
    DO UPDATE SET
      seq_value = CASE WHEN public.quote_sequences_franchise.last_reset_bucket IS DISTINCT FROM v_bucket THEN 1 ELSE public.quote_sequences_franchise.seq_value + 1 END,
      last_reset_bucket = v_bucket
    RETURNING seq_value INTO v_seq;
  ELSE
    INSERT INTO public.quote_sequences_tenant (tenant_id, seq_value, last_reset_bucket)
    VALUES (p_tenant_id, 1, v_bucket)
    ON CONFLICT (tenant_id)
    DO UPDATE SET
      seq_value = CASE WHEN public.quote_sequences_tenant.last_reset_bucket IS DISTINCT FROM v_bucket THEN 1 ELSE public.quote_sequences_tenant.seq_value + 1 END,
      last_reset_bucket = v_bucket
    RETURNING seq_value INTO v_seq;
  END IF;

  -- Date part (YYMMDD)
  v_date := to_char((now() at time zone 'UTC'), 'YYMMDD');

  RETURN v_prefix || v_date || lpad(v_seq::text, 8, '0');
END;
$$;

-- Preview next quote number without incrementing
CREATE OR REPLACE FUNCTION public.preview_next_quote_number(p_tenant_id uuid, p_franchise_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_policy text := 'none';
  v_bucket text;
  v_seq_current bigint := NULL;
  v_last_bucket text := NULL;
  v_next_seq bigint := 1;
  v_date text;
BEGIN
  -- Determine prefix and policy
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_policy
    FROM public.quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;

    IF v_prefix IS NULL THEN
      SELECT prefix, reset_policy INTO v_prefix, v_policy
      FROM public.quote_number_config_tenant
      WHERE tenant_id = p_tenant_id;
    END IF;
  ELSE
    SELECT prefix, reset_policy INTO v_prefix, v_policy
    FROM public.quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;

  IF v_prefix IS NULL THEN v_prefix := 'QUO'; END IF;
  IF v_policy IS NULL THEN v_policy := 'none'; END IF;

  v_bucket := public._current_reset_bucket(v_policy);

  -- Read current sequence
  IF p_franchise_id IS NOT NULL THEN
    SELECT seq_value, last_reset_bucket INTO v_seq_current, v_last_bucket
    FROM public.quote_sequences_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;
  ELSE
    SELECT seq_value, last_reset_bucket INTO v_seq_current, v_last_bucket
    FROM public.quote_sequences_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;

  IF v_seq_current IS NULL THEN
    v_next_seq := 1;
  ELSE
    IF v_last_bucket IS DISTINCT FROM v_bucket THEN
      v_next_seq := 1;
    ELSE
      v_next_seq := v_seq_current + 1;
    END IF;
  END IF;

  v_date := to_char((now() at time zone 'UTC'), 'YYMMDD');
  RETURN v_prefix || v_date || lpad(v_next_seq::text, 8, '0');
END;
$$;