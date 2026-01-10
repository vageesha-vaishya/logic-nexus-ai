-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'VIEW_CHANGE'
    resource_type TEXT NOT NULL, -- Table name or feature area
    details JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON public.audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies
-- Platform Admins can view all logs
CREATE POLICY "Platform admins view all logs" ON public.audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'platform_admin'
        )
    );

-- Users can view their own logs (optional, maybe only admins should see)
CREATE POLICY "Users view own logs" ON public.audit_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- System/Service can insert logs (Users trigger this via RPC or direct insert if allowed)
-- Ideally, we only allow INSERT via authenticated users
CREATE POLICY "Users can insert logs" ON public.audit_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
