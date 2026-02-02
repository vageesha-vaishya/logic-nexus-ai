-- Fix Vendor RLS Policies
-- This migration adds Row Level Security (RLS) policies to the vendors and service_vendors tables.
-- It ensures that:
-- 1. Platform Admins can see/manage all vendors.
-- 2. Tenant users can only see/manage vendors belonging to their tenant.
-- 3. Global vendors (tenant_id IS NULL) are visible to all authenticated users (read-only).

-- Enable RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_vendors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "View Vendors" ON public.vendors;
DROP POLICY IF EXISTS "Manage Vendors" ON public.vendors;
DROP POLICY IF EXISTS "View Service Vendors" ON public.service_vendors;
DROP POLICY IF EXISTS "Manage Service Vendors" ON public.service_vendors;

-- Policy: View Vendors
-- 1. Global Vendors (tenant_id IS NULL) -> Visible to everyone (authenticated)
-- 2. Tenant Vendors (tenant_id IN user's tenants) -> Visible to tenant users
-- 3. Platform Admins -> Visible to all
CREATE POLICY "View Vendors" ON public.vendors
    FOR SELECT
    USING (
        (tenant_id IS NULL) OR 
        (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())) OR
        (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
    );

-- Policy: Manage Vendors (Insert/Update/Delete)
-- 1. Platform Admins -> Can manage all
-- 2. Tenant Admins -> Can manage their tenant's vendors
CREATE POLICY "Manage Vendors" ON public.vendors
    FOR ALL
    USING (
        (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')) OR
        (
            tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()) AND
            EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'tenant_admin')
        )
    );

-- Policy: View Service Vendors
-- Inherits visibility from the associated vendor
CREATE POLICY "View Service Vendors" ON public.service_vendors
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = service_vendors.vendor_id
            AND (
                (v.tenant_id IS NULL) OR 
                (v.tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())) OR
                (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
            )
        )
    );

-- Policy: Manage Service Vendors
-- Inherits manageability from the associated vendor
CREATE POLICY "Manage Service Vendors" ON public.service_vendors
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = service_vendors.vendor_id
            AND (
                (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')) OR
                (
                    v.tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()) AND
                    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'tenant_admin')
                )
            )
        )
    );
