-- Quote numbering configuration and generator
-- Pattern: <PREFIX(3)> <YY><MM><DD> <SEQ(8)> ; no separators

-- Tenant-level prefix config
CREATE TABLE IF NOT EXISTS public.quote_number_config_tenant (
  tenant_id uuid PRIMARY KEY,
  prefix text NOT NULL DEFAULT 'QUO',
  CONSTRAINT quote_number_config_tenant_prefix_len CHECK (char_length(prefix) = 3)
);

-- Franchise-level prefix config (overrides tenant when present)
CREATE TABLE IF NOT EXISTS public.quote_number_config_franchise (
  tenant_id uuid NOT NULL,
  franchise_id uuid NOT NULL,
  prefix text NOT NULL DEFAULT 'QUO',
  CONSTRAINT quote_number_config_franchise_prefix_len CHECK (char_length(prefix) = 3),
  CONSTRAINT quote_number_config_franchise_pk PRIMARY KEY (tenant_id, franchise_id)
);

-- Tenant-level sequence storage (independent per tenant)
CREATE TABLE IF NOT EXISTS public.quote_sequences_tenant (
  tenant_id uuid PRIMARY KEY,
  seq_value bigint NOT NULL DEFAULT 0
);

-- Franchise-level sequence storage (independent per franchise within a tenant)
CREATE TABLE IF NOT EXISTS public.quote_sequences_franchise (
  tenant_id uuid NOT NULL,
  franchise_id uuid NOT NULL,
  seq_value bigint NOT NULL DEFAULT 0,
  CONSTRAINT quote_sequences_franchise_pk PRIMARY KEY (tenant_id, franchise_id)
);

-- Function: get next sequence and build quote number
CREATE OR REPLACE FUNCTION public.generate_quote_number(p_tenant_id uuid, p_franchise_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_seq bigint;
  v_date text;
BEGIN
  -- Determine prefix: franchise override > tenant > default
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix INTO v_prefix
    FROM public.quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;

    IF v_prefix IS NULL THEN
      SELECT prefix INTO v_prefix
      FROM public.quote_number_config_tenant
      WHERE tenant_id = p_tenant_id;
    END IF;
  ELSE
    SELECT prefix INTO v_prefix
    FROM public.quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;

  IF v_prefix IS NULL THEN
    v_prefix := 'QUO';
  END IF;

  -- Acquire next sequence atomically
  IF p_franchise_id IS NOT NULL THEN
    INSERT INTO public.quote_sequences_franchise (tenant_id, franchise_id, seq_value)
    VALUES (p_tenant_id, p_franchise_id, 1)
    ON CONFLICT (tenant_id, franchise_id)
    DO UPDATE SET seq_value = public.quote_sequences_franchise.seq_value + 1
    RETURNING seq_value INTO v_seq;
  ELSE
    INSERT INTO public.quote_sequences_tenant (tenant_id, seq_value)
    VALUES (p_tenant_id, 1)
    ON CONFLICT (tenant_id)
    DO UPDATE SET seq_value = public.quote_sequences_tenant.seq_value + 1
    RETURNING seq_value INTO v_seq;
  END IF;

  -- Build date part (YYMMDD) using UTC now()
  v_date := to_char((now() at time zone 'UTC'), 'YYMMDD');

  -- Assemble final number: PREFIX + YYMMDD + 8-digit sequence
  RETURN v_prefix || v_date || lpad(v_seq::text, 8, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_quote_number(uuid, uuid)
IS 'Generates quote_number as <PREFIX(3)><YY><MM><DD><SEQ(8)>, with franchise override and atomic per-tenant/franchise sequence.';

-- Trigger function to set quote_number before insert
CREATE OR REPLACE FUNCTION public.trg_set_quote_number_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    IF NEW.tenant_id IS NULL THEN
      RAISE EXCEPTION 'tenant_id is required to generate quote_number';
    END IF;
    NEW.quote_number := public.generate_quote_number(NEW.tenant_id, NEW.franchise_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on public.quotes
DROP TRIGGER IF EXISTS trg_set_quote_number_before_insert ON public.quotes;
CREATE TRIGGER trg_set_quote_number_before_insert
BEFORE INSERT ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.trg_set_quote_number_before_insert();