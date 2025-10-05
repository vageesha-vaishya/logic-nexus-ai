-- Phase 0: Subscription & Billing Infrastructure

-- Create enum types for subscription system
CREATE TYPE subscription_tier AS ENUM ('starter', 'professional', 'business', 'enterprise');
CREATE TYPE billing_period AS ENUM ('monthly', 'annual');
CREATE TYPE subscription_status AS ENUM ('active', 'trial', 'past_due', 'canceled', 'expired');
CREATE TYPE plan_type AS ENUM ('crm_base', 'service_addon', 'bundle');

-- 1. Subscription Plans Table
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan_type plan_type NOT NULL DEFAULT 'crm_base',
  tier subscription_tier,
  billing_period billing_period NOT NULL DEFAULT 'monthly',
  price_monthly NUMERIC(10,2) NOT NULL,
  price_annual NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  stripe_price_id TEXT,
  stripe_product_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Tenant Subscriptions Table
CREATE TABLE public.tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status subscription_status NOT NULL DEFAULT 'trial',
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  trial_end TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, plan_id, status)
);

-- 3. Usage Records Table
CREATE TABLE public.usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.tenant_subscriptions(id) ON DELETE SET NULL,
  feature_key TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  limit_count INTEGER,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Subscription Invoices Table
CREATE TABLE public.subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.tenant_subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id TEXT UNIQUE,
  invoice_number TEXT UNIQUE,
  amount_due NUMERIC(10,2) NOT NULL,
  amount_paid NUMERIC(10,2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft',
  due_date TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  invoice_pdf_url TEXT,
  billing_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Subscription Features Table
CREATE TABLE public.subscription_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT NOT NULL UNIQUE,
  feature_name TEXT NOT NULL,
  feature_category TEXT NOT NULL,
  description TEXT,
  is_usage_based BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Update Tenants Table with Stripe fields
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS billing_email TEXT,
  ADD COLUMN IF NOT EXISTS payment_method JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS billing_address JSONB DEFAULT '{}'::jsonb;

-- Create indexes for performance
CREATE INDEX idx_tenant_subscriptions_tenant ON public.tenant_subscriptions(tenant_id);
CREATE INDEX idx_tenant_subscriptions_status ON public.tenant_subscriptions(status);
CREATE INDEX idx_tenant_subscriptions_stripe ON public.tenant_subscriptions(stripe_subscription_id);
CREATE INDEX idx_usage_records_tenant_feature ON public.usage_records(tenant_id, feature_key);
CREATE INDEX idx_usage_records_period ON public.usage_records(period_start, period_end);
CREATE INDEX idx_subscription_invoices_tenant ON public.subscription_invoices(tenant_id);
CREATE INDEX idx_subscription_invoices_stripe ON public.subscription_invoices(stripe_invoice_id);

-- Create helper function: Check if tenant has a specific feature
CREATE OR REPLACE FUNCTION public.tenant_has_feature(
  _tenant_id UUID,
  _feature_key TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_subscriptions ts
    JOIN public.subscription_plans sp ON ts.plan_id = sp.id
    WHERE ts.tenant_id = _tenant_id
      AND ts.status = 'active'
      AND ts.current_period_end > now()
      AND (
        sp.features @> jsonb_build_array(jsonb_build_object('key', _feature_key))
        OR sp.features @> jsonb_build_array(_feature_key)
      )
  );
$$;

-- Create helper function: Check usage limit for a feature
CREATE OR REPLACE FUNCTION public.check_usage_limit(
  _tenant_id UUID,
  _feature_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_usage INTEGER;
  usage_limit INTEGER;
BEGIN
  -- Get current usage for the current period
  SELECT usage_count, limit_count
  INTO current_usage, usage_limit
  FROM public.usage_records
  WHERE tenant_id = _tenant_id
    AND feature_key = _feature_key
    AND period_start <= now()
    AND period_end >= now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If no usage record exists, assume allowed
  IF current_usage IS NULL THEN
    RETURN true;
  END IF;
  
  -- If no limit set, assume unlimited
  IF usage_limit IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if under limit
  RETURN current_usage < usage_limit;
END;
$$;

-- Create helper function: Increment feature usage
CREATE OR REPLACE FUNCTION public.increment_feature_usage(
  _tenant_id UUID,
  _feature_key TEXT,
  _increment INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usage_records (
    tenant_id,
    feature_key,
    usage_count,
    period_start,
    period_end
  )
  VALUES (
    _tenant_id,
    _feature_key,
    _increment,
    date_trunc('month', now()),
    date_trunc('month', now()) + INTERVAL '1 month'
  )
  ON CONFLICT (tenant_id, feature_key, period_start)
  DO UPDATE SET
    usage_count = usage_records.usage_count + _increment,
    updated_at = now();
END;
$$;

-- Create helper function: Get tenant's current plan tier
CREATE OR REPLACE FUNCTION public.get_tenant_plan_tier(
  _tenant_id UUID
)
RETURNS subscription_tier
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.tier
  FROM public.tenant_subscriptions ts
  JOIN public.subscription_plans sp ON ts.plan_id = sp.id
  WHERE ts.tenant_id = _tenant_id
    AND ts.status = 'active'
    AND sp.plan_type = 'crm_base'
  ORDER BY ts.current_period_end DESC
  LIMIT 1;
$$;

-- Enable RLS on all subscription tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_features ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans (Public read for active plans)
CREATE POLICY "Anyone can view active subscription plans"
  ON public.subscription_plans
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Platform admins can manage subscription plans"
  ON public.subscription_plans
  FOR ALL
  USING (public.is_platform_admin(auth.uid()));

-- RLS Policies for tenant_subscriptions
CREATE POLICY "Platform admins can manage all subscriptions"
  ON public.tenant_subscriptions
  FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can view own subscriptions"
  ON public.tenant_subscriptions
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = public.get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Tenant admins can update own subscriptions"
  ON public.tenant_subscriptions
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = public.get_user_tenant_id(auth.uid())
  );

-- RLS Policies for usage_records
CREATE POLICY "Platform admins can manage all usage records"
  ON public.usage_records
  FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can view own usage records"
  ON public.usage_records
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = public.get_user_tenant_id(auth.uid())
  );

-- RLS Policies for subscription_invoices
CREATE POLICY "Platform admins can manage all invoices"
  ON public.subscription_invoices
  FOR ALL
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can view own invoices"
  ON public.subscription_invoices
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = public.get_user_tenant_id(auth.uid())
  );

-- RLS Policies for subscription_features (Public read)
CREATE POLICY "Anyone can view subscription features"
  ON public.subscription_features
  FOR SELECT
  USING (true);

CREATE POLICY "Platform admins can manage subscription features"
  ON public.subscription_features
  FOR ALL
  USING (public.is_platform_admin(auth.uid()));

-- Add updated_at trigger for all subscription tables
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_subscriptions_updated_at
  BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_usage_records_updated_at
  BEFORE UPDATE ON public.usage_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscription_invoices_updated_at
  BEFORE UPDATE ON public.subscription_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscription_features_updated_at
  BEFORE UPDATE ON public.subscription_features
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();