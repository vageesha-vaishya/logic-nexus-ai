-- Ensure quote numbering tables can be recreated safely
DROP TABLE IF EXISTS public.quote_number_sequences CASCADE;
DROP TABLE IF EXISTS public.quote_number_config_franchise CASCADE;
DROP TABLE IF EXISTS public.quote_number_config_tenant CASCADE;
DROP TYPE IF EXISTS quote_reset_policy CASCADE;

-- Create enum for reset policies
CREATE TYPE quote_reset_policy AS ENUM ('none', 'daily', 'monthly', 'yearly');

-- Tenant-level quote numbering configuration
CREATE TABLE public.quote_number_config_tenant (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL DEFAULT 'QUO' CHECK (length(prefix) = 3),
  reset_policy quote_reset_policy NOT NULL DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Franchise-level quote numbering configuration
CREATE TABLE public.quote_number_config_franchise (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL DEFAULT 'QUO' CHECK (length(prefix) = 3),
  reset_policy quote_reset_policy NOT NULL DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (tenant_id, franchise_id)
);

-- Quote number sequences table
CREATE TABLE public.quote_number_sequences (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create partial unique indexes for sequences
CREATE UNIQUE INDEX unique_tenant_period_idx 
  ON public.quote_number_sequences (tenant_id, period_key) 
  WHERE franchise_id IS NULL;

CREATE UNIQUE INDEX unique_franchise_period_idx 
  ON public.quote_number_sequences (tenant_id, franchise_id, period_key) 
  WHERE franchise_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.quote_number_config_tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_number_config_franchise ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_number_sequences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant quote config"
  ON public.quote_number_config_tenant FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant admins can manage quote config"
  ON public.quote_number_config_tenant FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'tenant_admin'));

CREATE POLICY "Users can view their franchise quote config"
  ON public.quote_number_config_franchise FOR SELECT
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Franchise admins can manage their quote config"
  ON public.quote_number_config_franchise FOR ALL
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    franchise_id = public.get_user_franchise_id(auth.uid()) AND
    public.has_role(auth.uid(), 'franchise_admin')
  );

CREATE POLICY "Users can view sequences for their context"
  ON public.quote_number_sequences FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid()) AND
    (franchise_id IS NULL OR franchise_id = public.get_user_franchise_id(auth.uid()))
  );

CREATE POLICY "System can manage sequences"
  ON public.quote_number_sequences FOR ALL
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));