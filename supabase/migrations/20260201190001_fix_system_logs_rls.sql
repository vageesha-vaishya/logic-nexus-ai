-- Allow anon users to insert system logs (for login page errors, boot errors)
DROP POLICY IF EXISTS "Anon can insert system logs" ON public.system_logs;
CREATE POLICY "Anon can insert system logs" ON public.system_logs
    FOR INSERT
    TO anon
    WITH CHECK (true);
