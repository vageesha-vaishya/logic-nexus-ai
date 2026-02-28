-- Migration: Broaden permissions for Quote Numbering Config
-- Description: Allows platform_admin, tenant_admin, and sales_manager to manage quote numbering settings

-- 1. Policies for quote_number_config_tenant
ALTER TABLE public.quote_number_config_tenant ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant admins manage tenant quote config" ON public.quote_number_config_tenant;
DROP POLICY IF EXISTS "Tenant admins can manage tenant quote config" ON public.quote_number_config_tenant;
DROP POLICY IF EXISTS "Users can view tenant config" ON public.quote_number_config_tenant;
DROP POLICY IF EXISTS "Users can view tenant quote config" ON public.quote_number_config_tenant;
DROP POLICY IF EXISTS "Users view tenant quote config" ON public.quote_number_config_tenant;
DROP POLICY IF EXISTS "Platform admins can manage all tenant quote configs" ON public.quote_number_config_tenant;
DROP POLICY IF EXISTS "Admins manage tenant quote config" ON public.quote_number_config_tenant;

CREATE POLICY "Admins manage tenant quote config"
ON public.quote_number_config_tenant FOR ALL
USING (
    has_role(auth.uid(), 'platform_admin')
    OR
    (
        tenant_id = get_user_tenant_id(auth.uid()) 
        AND (
            has_role(auth.uid(), 'tenant_admin') OR 
            has_role(auth.uid(), 'sales_manager')
        )
    )
);

CREATE POLICY "Users view tenant quote config"
ON public.quote_number_config_tenant FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- 2. Policies for quote_number_config_franchise
ALTER TABLE public.quote_number_config_franchise ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can manage all franchise configs" ON public.quote_number_config_franchise;
DROP POLICY IF EXISTS "Platform admins can manage all franchise quote configs" ON public.quote_number_config_franchise;
DROP POLICY IF EXISTS "Tenant admins can manage franchise configs" ON public.quote_number_config_franchise;
DROP POLICY IF EXISTS "Tenant admins can manage franchise quote configs" ON public.quote_number_config_franchise;
DROP POLICY IF EXISTS "Franchise admins can manage own config" ON public.quote_number_config_franchise;
DROP POLICY IF EXISTS "Franchise admins can manage franchise quote config" ON public.quote_number_config_franchise;
DROP POLICY IF EXISTS "Users can view franchise config" ON public.quote_number_config_franchise;
DROP POLICY IF EXISTS "Users can view franchise quote config" ON public.quote_number_config_franchise;
DROP POLICY IF EXISTS "Admins manage franchise quote config" ON public.quote_number_config_franchise;
DROP POLICY IF EXISTS "Franchise admins manage franchise quote config" ON public.quote_number_config_franchise;
DROP POLICY IF EXISTS "Users view franchise quote config" ON public.quote_number_config_franchise;

CREATE POLICY "Admins manage franchise quote config"
ON public.quote_number_config_franchise FOR ALL
USING (
    tenant_id = get_user_tenant_id(auth.uid()) 
    AND (
        has_role(auth.uid(), 'tenant_admin') OR 
        has_role(auth.uid(), 'platform_admin') OR 
        has_role(auth.uid(), 'sales_manager')
    )
);

CREATE POLICY "Franchise admins manage franchise quote config"
ON public.quote_number_config_franchise FOR ALL
USING (
    franchise_id = get_user_franchise_id(auth.uid())
    AND has_role(auth.uid(), 'franchise_admin')
);

CREATE POLICY "Users view franchise quote config"
ON public.quote_number_config_franchise FOR SELECT
USING (
    tenant_id = get_user_tenant_id(auth.uid()) OR
    franchise_id = get_user_franchise_id(auth.uid())
);
