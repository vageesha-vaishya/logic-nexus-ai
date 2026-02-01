-- Migration: Enable Partitioning for system_logs
-- Date: 2026-01-31

-- 0. Ensure log_level type exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'log_level') THEN
        CREATE TYPE public.log_level AS ENUM ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL');
    END IF;
END $$;

-- 1. Rename existing table to back it up (if it exists and is not partitioned)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_logs') THEN
        -- Check if it's already partitioned (relkind = 'p')
        IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'system_logs' AND c.relkind = 'p') THEN
            ALTER TABLE public.system_logs RENAME TO system_logs_legacy;
        END IF;
    END IF;
END $$;

-- 2. Create Partitioned Table
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID DEFAULT gen_random_uuid(),
    level public.log_level NOT NULL DEFAULT 'INFO',
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    correlation_id TEXT,
    component TEXT,
    environment TEXT NOT NULL DEFAULT 'development',
    user_id UUID REFERENCES auth.users(id),
    tenant_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (created_at, id) -- Partition key must be part of PK
) PARTITION BY RANGE (created_at);

-- 3. Create Partitions (Current + Next 2 Months)
-- January 2026
CREATE TABLE IF NOT EXISTS public.system_logs_y2026m01 PARTITION OF public.system_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- February 2026
CREATE TABLE IF NOT EXISTS public.system_logs_y2026m02 PARTITION OF public.system_logs
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- March 2026
CREATE TABLE IF NOT EXISTS public.system_logs_y2026m03 PARTITION OF public.system_logs
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- 4. Restore Data (if legacy exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_logs_legacy') THEN
        INSERT INTO public.system_logs (id, level, message, metadata, correlation_id, component, environment, user_id, tenant_id, created_at)
        SELECT id, level, message, metadata, correlation_id, component, environment, user_id, tenant_id, created_at
        FROM public.system_logs_legacy;
        
        -- Drop legacy table after successful migration
        DROP TABLE public.system_logs_legacy;
    END IF;
END $$;

-- 5. Re-apply Indexes (must be done on the partitioned table, Postgres propagates them)
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_component ON public.system_logs(component);
CREATE INDEX IF NOT EXISTS idx_system_logs_correlation_id ON public.system_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_metadata_gin ON public.system_logs USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_system_logs_text_search ON public.system_logs USING GIN (to_tsvector('english', message));
-- created_at index is usually implicit in partition key, but good to have for range queries
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at DESC);

-- 6. Re-apply RLS
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Policies (need to be re-created on the new table)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Platform admins view all system logs" ON public.system_logs;
    DROP POLICY IF EXISTS "Service role can insert system logs" ON public.system_logs;
    DROP POLICY IF EXISTS "Authenticated users can insert system logs" ON public.system_logs;
END $$;

CREATE POLICY "Platform admins view all system logs" ON public.system_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'platform_admin'
        )
    );

CREATE POLICY "Service role can insert system logs" ON public.system_logs
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Authenticated users can insert system logs" ON public.system_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 7. Update Cleanup Function to Drop Partitions
CREATE OR REPLACE FUNCTION public.cleanup_old_log_partitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    partition_date date;
    partition_name text;
BEGIN
    -- Logic to find and drop partitions older than retention period would go here
    -- For now, we keep the simple delete function as a fallback, but strictly speaking
    -- we should drop tables like 'system_logs_y2025m01'
    NULL; 
END;
$$;
