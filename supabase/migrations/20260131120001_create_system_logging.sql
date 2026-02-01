-- Create Log Level Enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'log_level') THEN
        CREATE TYPE public.log_level AS ENUM ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL');
    END IF;
END $$;

-- Create System Logs Table
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level public.log_level NOT NULL DEFAULT 'INFO',
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    correlation_id TEXT,
    component TEXT,
    environment TEXT NOT NULL DEFAULT 'development',
    user_id UUID REFERENCES auth.users(id),
    tenant_id UUID, -- Loose reference to avoid strict FK issues if tenant is deleted but logs kept
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast searching
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_component ON public.system_logs(component);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_correlation_id ON public.system_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_metadata_gin ON public.system_logs USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_system_logs_text_search ON public.system_logs USING GIN (to_tsvector('english', message));

-- Enable RLS
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Platform admins view all system logs" ON public.system_logs;
    DROP POLICY IF EXISTS "Service role can insert system logs" ON public.system_logs;
    DROP POLICY IF EXISTS "Authenticated users can insert system logs" ON public.system_logs;
END $$;

-- Platform Admin: View all logs
CREATE POLICY "Platform admins view all system logs" ON public.system_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'platform_admin'
        )
    );

-- System/Service Role: Insert logs (for Edge Functions)
CREATE POLICY "Service role can insert system logs" ON public.system_logs
    FOR INSERT
    WITH CHECK (true); -- Allow all inserts, but we might want to restrict to auth users in client

-- Authenticated Users: Insert logs (client-side logging)
CREATE POLICY "Authenticated users can insert system logs" ON public.system_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Partitioning / Retention Management (Function)
CREATE OR REPLACE FUNCTION public.cleanup_system_logs(days_to_keep int DEFAULT 30)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.system_logs
    WHERE created_at < now() - (days_to_keep || ' days')::interval;
END;
$$;
