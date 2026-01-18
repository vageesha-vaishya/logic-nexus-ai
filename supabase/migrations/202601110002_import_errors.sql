-- Add completed_at to import_history for duration calculation
ALTER TABLE public.import_history ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Create import_errors table for detailed reporting
CREATE TABLE IF NOT EXISTS public.import_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID REFERENCES public.import_history(id) ON DELETE CASCADE,
    row_number INTEGER,
    field TEXT,
    error_message TEXT,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.import_errors ENABLE ROW LEVEL SECURITY;

-- Regular authenticated user policies (view and insert only)
DROP POLICY IF EXISTS "Users can view import errors" ON public.import_errors;
CREATE POLICY "Users can view import errors" ON public.import_errors
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can insert import errors" ON public.import_errors;
CREATE POLICY "Users can insert import errors" ON public.import_errors
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Super Admin / Platform Admin policies (Full Access)
-- Grant full access to import_errors for platform admins
DROP POLICY IF EXISTS "Platform admins can manage all import errors" ON public.import_errors;
CREATE POLICY "Platform admins can manage all import errors" ON public.import_errors
    FOR ALL USING (public.is_platform_admin(auth.uid()));

-- Grant full access to import_history for platform admins (restoring full control including DELETE)
DROP POLICY IF EXISTS "Platform admins can manage all import history" ON public.import_history;
CREATE POLICY "Platform admins can manage all import history" ON public.import_history
    FOR ALL USING (public.is_platform_admin(auth.uid()));

-- Grant full access to import_history_details for platform admins
DROP POLICY IF EXISTS "Platform admins can manage all import details" ON public.import_history_details;
CREATE POLICY "Platform admins can manage all import details" ON public.import_history_details
    FOR ALL USING (public.is_platform_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_import_errors_import_id ON public.import_errors(import_id);

