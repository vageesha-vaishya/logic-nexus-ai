-- Migration: Enhance Audit Logs
-- Description: Adds resource_id, tenant_id, franchise_id to audit_logs and updates RLS.

-- 1. Add columns if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'resource_id') THEN
        ALTER TABLE public.audit_logs ADD COLUMN resource_id UUID;
        CREATE INDEX idx_audit_logs_resource_id ON public.audit_logs(resource_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.audit_logs ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
        CREATE INDEX idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'franchise_id') THEN
        ALTER TABLE public.audit_logs ADD COLUMN franchise_id UUID REFERENCES public.franchises(id);
        CREATE INDEX idx_audit_logs_franchise_id ON public.audit_logs(franchise_id);
    END IF;
END $$;

-- 2. Update RLS Policies

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Platform admins view all logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users view own logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Tenant admins view tenant logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Franchise admins view franchise logs" ON public.audit_logs;

-- Platform Admins can view all logs
CREATE POLICY "Platform admins view all logs" ON public.audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'platform_admin'
        )
    );

-- Tenant Admins can view logs for their tenant
CREATE POLICY "Tenant admins view tenant logs" ON public.audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'tenant_admin'
            AND ur.tenant_id = audit_logs.tenant_id
        )
    );

-- Franchise Admins can view logs for their franchise
CREATE POLICY "Franchise admins view franchise logs" ON public.audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'franchise_admin'
            AND ur.franchise_id = audit_logs.franchise_id
        )
    );

-- Users can view their own logs
CREATE POLICY "Users view own logs" ON public.audit_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert logs (must be authenticated)
CREATE POLICY "Users can insert logs" ON public.audit_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 3. Add function to automatically set tenant_id/franchise_id on insert if not provided
-- This is useful if the insertion comes from a trigger that doesn't explicitly set them,
-- although ScopedDataAccess should handle this.
CREATE OR REPLACE FUNCTION public.set_audit_log_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        NEW.tenant_id := (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1);
    END IF;
    IF NEW.franchise_id IS NULL THEN
        NEW.franchise_id := (SELECT franchise_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_audit_log_context ON public.audit_logs;
CREATE TRIGGER trg_set_audit_log_context
    BEFORE INSERT ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.set_audit_log_context();
