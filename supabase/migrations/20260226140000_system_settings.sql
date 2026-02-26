-- Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, setting_key)
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policies
-- Platform Admins can do everything
CREATE POLICY "Platform Admins can do everything on system_settings" ON public.system_settings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'platform_admin'
        )
    );

-- Tenant Admins can view/edit their own tenant settings
CREATE POLICY "Tenant Admins can view own settings" ON public.system_settings
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'tenant_admin'
        )
    );

CREATE POLICY "Tenant Admins can update own settings" ON public.system_settings
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'tenant_admin'
        )
    );

CREATE POLICY "Tenant Admins can update own settings update" ON public.system_settings
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'tenant_admin'
        )
    );

-- Regular users can view settings for their tenant
CREATE POLICY "Users can view own tenant settings" ON public.system_settings
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
        )
    );
