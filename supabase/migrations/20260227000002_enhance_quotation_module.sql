-- Migration: Enhance Quotation Configuration and Smart Mode
-- Description: Sets Quotation Composer as default, adds Smart Mode configuration, and prepares for multi-option logic

-- 1. Create or Update Quotation Configuration Table
CREATE TABLE IF NOT EXISTS public.quotation_configuration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    default_module TEXT NOT NULL DEFAULT 'composer' CHECK (default_module IN ('composer', 'legacy', 'smart')),
    smart_mode_enabled BOOLEAN DEFAULT FALSE,
    smart_mode_settings JSONB DEFAULT '{}'::jsonb, -- Store specific smart mode configs
    multi_option_enabled BOOLEAN DEFAULT TRUE,
    auto_ranking_criteria JSONB DEFAULT '{"cost": 0.5, "transit_time": 0.3, "reliability": 0.2}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_quotation_config_tenant UNIQUE (tenant_id)
);

-- 2. Add RLS Policies
ALTER TABLE public.quotation_configuration ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their tenant quotation config" ON public.quotation_configuration;
CREATE POLICY "Users can view their tenant quotation config"
ON public.quotation_configuration FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage quotation config" ON public.quotation_configuration;
CREATE POLICY "Admins can manage quotation config"
ON public.quotation_configuration FOR ALL
USING (
    -- Platform admins can manage ALL configs
    has_role(auth.uid(), 'platform_admin')
    OR
    -- Tenant admins and managers can manage their own tenant config
    (
        tenant_id = get_user_tenant_id(auth.uid()) 
        AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'sales_manager'))
    )
);

-- 3. Add Smart Mode preferences to User Profiles (for persistence)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS quotation_preferences JSONB DEFAULT '{"smart_mode_active": false}'::jsonb;

-- 4. Seed Default Configuration for existing tenants
INSERT INTO public.quotation_configuration (tenant_id, default_module, smart_mode_enabled)
SELECT id, 'composer', false
FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- 5. Prepare Quotation Options for Multi-Option Logic
-- Enhance quotation_version_options to support ranking and recommendation data
ALTER TABLE public.quotation_version_options
ADD COLUMN IF NOT EXISTS rank_score NUMERIC,
ADD COLUMN IF NOT EXISTS rank_details JSONB,
ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recommendation_reason TEXT;

-- 6. Create Comparison Snapshot Table (for dashboard caching)
CREATE TABLE IF NOT EXISTS public.quotation_comparison_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_version_id UUID NOT NULL REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
    comparison_data JSONB NOT NULL, -- Stores side-by-side metrics
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.quotation_comparison_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view comparison snapshots" ON public.quotation_comparison_snapshots;
CREATE POLICY "Users can view comparison snapshots"
ON public.quotation_comparison_snapshots FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.quotation_versions qv
        JOIN public.quotes q ON qv.quote_id = q.id
        WHERE qv.id = quotation_comparison_snapshots.quotation_version_id
        AND q.tenant_id = get_user_tenant_id(auth.uid())
    )
);
