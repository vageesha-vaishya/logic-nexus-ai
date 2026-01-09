-- Fix RLS policies for import_history tables

-- 1. Ensure RLS is enabled
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_history_details ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Users can view import history" ON public.import_history;
DROP POLICY IF EXISTS "Users can insert import history" ON public.import_history;
DROP POLICY IF EXISTS "Users can update import history" ON public.import_history;
DROP POLICY IF EXISTS "Users can delete import history" ON public.import_history;

DROP POLICY IF EXISTS "Users can view import details" ON public.import_history_details;
DROP POLICY IF EXISTS "Users can insert import details" ON public.import_history_details;

-- 3. Create permissive policies for authenticated users
-- View: Allow seeing all history
CREATE POLICY "Users can view import history" ON public.import_history
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Insert: Allow inserting new history records
CREATE POLICY "Users can insert import history" ON public.import_history
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Update: Allow updating records (e.g. status, summary)
CREATE POLICY "Users can update import history" ON public.import_history
    FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Details Table Policies
CREATE POLICY "Users can view import details" ON public.import_history_details
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert import details" ON public.import_history_details
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- 4. Grant table permissions to authenticated role
GRANT SELECT, INSERT, UPDATE ON public.import_history TO authenticated;
GRANT SELECT, INSERT ON public.import_history_details TO authenticated;
