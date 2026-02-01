BEGIN;

-- 1. Enable RLS on VRM tables
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_vendors ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts if re-running
DROP POLICY IF EXISTS "Enable access for authenticated users" ON public.vendors;
DROP POLICY IF EXISTS "Enable access for authenticated users" ON public.service_vendors;

-- 3. Create permissive policies for Phase 5 initialization
-- We allow all authenticated users to manage vendors for now.
-- In a future iteration, we will restrict this to tenant_id match.
CREATE POLICY "Enable access for authenticated users" ON public.vendors
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Enable access for authenticated users" ON public.service_vendors
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

COMMIT;
