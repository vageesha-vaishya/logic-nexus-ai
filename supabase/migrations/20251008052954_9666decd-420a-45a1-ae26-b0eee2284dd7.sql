-- Create quote numbering configuration tables and functions

-- Create enum for reset policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'quote_reset_policy'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.quote_reset_policy AS ENUM ('none', 'daily', 'monthly', 'yearly');
  END IF;
END $$;

-- Tenant-level quote numbering configuration
CREATE TABLE IF NOT EXISTS public.quote_number_config_tenant (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL DEFAULT 'QUO' CHECK (length(prefix) = 3),
  reset_policy quote_reset_policy NOT NULL DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Franchise-level quote numbering configuration (overrides tenant config)
CREATE TABLE IF NOT EXISTS public.quote_number_config_franchise (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL DEFAULT 'QUO' CHECK (length(prefix) = 3),
  reset_policy quote_reset_policy NOT NULL DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (tenant_id, franchise_id)
);

-- Table to track quote number sequences
CREATE TABLE IF NOT EXISTS public.quote_number_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL, -- e.g., '2025-01-15' for daily, '2025-01' for monthly, '2025' for yearly
  last_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (tenant_id, franchise_id, period_key)
);

-- Enable RLS
ALTER TABLE public.quote_number_config_tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_number_config_franchise ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_number_sequences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quote_number_config_tenant
DROP POLICY IF EXISTS "Platform admins can manage all tenant configs" ON public.quote_number_config_tenant;
CREATE POLICY "Platform admins can manage all tenant configs"
  ON public.quote_number_config_tenant
  FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage own config" ON public.quote_number_config_tenant;
CREATE POLICY "Tenant admins can manage own config"
  ON public.quote_number_config_tenant
  FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant config" ON public.quote_number_config_tenant;
CREATE POLICY "Users can view tenant config"
  ON public.quote_number_config_tenant
  FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for quote_number_config_franchise
DROP POLICY IF EXISTS "Platform admins can manage all franchise configs" ON public.quote_number_config_franchise;
CREATE POLICY "Platform admins can manage all franchise configs"
  ON public.quote_number_config_franchise
  FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage franchise configs" ON public.quote_number_config_franchise;
CREATE POLICY "Tenant admins can manage franchise configs"
  ON public.quote_number_config_franchise
  FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Franchise admins can manage own config" ON public.quote_number_config_franchise;
CREATE POLICY "Franchise admins can manage own config"
  ON public.quote_number_config_franchise
  FOR ALL
  USING (has_role(auth.uid(), 'franchise_admin'::app_role) AND franchise_id = get_user_franchise_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view franchise config" ON public.quote_number_config_franchise;
CREATE POLICY "Users can view franchise config"
  ON public.quote_number_config_franchise
  FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for quote_number_sequences
DROP POLICY IF EXISTS "Platform admins can manage all sequences" ON public.quote_number_sequences;
CREATE POLICY "Platform admins can manage all sequences"
  ON public.quote_number_sequences
  FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can view sequences" ON public.quote_number_sequences;
CREATE POLICY "Tenant admins can view sequences"
  ON public.quote_number_sequences
  FOR SELECT
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

-- Function to preview next quote number
CREATE OR REPLACE FUNCTION public.preview_next_quote_number(
  p_tenant_id UUID,
  p_franchise_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_reset_policy quote_reset_policy;
  v_period_key TEXT;
  v_next_seq INTEGER;
BEGIN
  -- Get configuration (franchise overrides tenant)
  IF p_franchise_id IS NOT NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM quote_number_config_franchise
    WHERE tenant_id = p_tenant_id AND franchise_id = p_franchise_id;
  END IF;
  
  -- Fall back to tenant config if no franchise config
  IF v_prefix IS NULL THEN
    SELECT prefix, reset_policy INTO v_prefix, v_reset_policy
    FROM quote_number_config_tenant
    WHERE tenant_id = p_tenant_id;
  END IF;
  
  -- Default values if no config exists
  v_prefix := COALESCE(v_prefix, 'QUO');
  v_reset_policy := COALESCE(v_reset_policy, 'none'::quote_reset_policy);
  
  -- Determine period key based on reset policy
  v_period_key := CASE v_reset_policy
    WHEN 'daily' THEN to_char(CURRENT_DATE, 'YYYY-MM-DD')
    WHEN 'monthly' THEN to_char(CURRENT_DATE, 'YYYY-MM')
    WHEN 'yearly' THEN to_char(CURRENT_DATE, 'YYYY')
    ELSE 'none'
  END;
  
  -- Get next sequence number
  SELECT COALESCE(last_sequence, 0) + 1 INTO v_next_seq
  FROM quote_number_sequences
  WHERE tenant_id = p_tenant_id
    AND (franchise_id = p_franchise_id OR (franchise_id IS NULL AND p_franchise_id IS NULL))
    AND period_key = v_period_key;
  
  v_next_seq := COALESCE(v_next_seq, 1);
  
  -- Format: PREFIX-YYYYMMDD-NNNN or PREFIX-YYYYMM-NNNN or PREFIX-YYYY-NNNN or PREFIX-NNNN
  RETURN CASE v_reset_policy
    WHEN 'daily' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    WHEN 'monthly' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    WHEN 'yearly' THEN v_prefix || '-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(v_next_seq::TEXT, 4, '0')
    ELSE v_prefix || '-' || lpad(v_next_seq::TEXT, 6, '0')
  END;
END;
$$;

-- Trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_quote_number_config_tenant_updated_at ON public.quote_number_config_tenant;
CREATE TRIGGER update_quote_number_config_tenant_updated_at
  BEFORE UPDATE ON public.quote_number_config_tenant
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_quote_number_config_franchise_updated_at ON public.quote_number_config_franchise;
CREATE TRIGGER update_quote_number_config_franchise_updated_at
  BEFORE UPDATE ON public.quote_number_config_franchise
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_quote_number_sequences_updated_at ON public.quote_number_sequences;
CREATE TRIGGER update_quote_number_sequences_updated_at
  BEFORE UPDATE ON public.quote_number_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
