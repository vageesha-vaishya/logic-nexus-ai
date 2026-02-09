-- Migration: Add DELETE policy for compliance_screenings
-- The table has SELECT, INSERT, UPDATE policies but was missing DELETE.
-- Compliance screenings are audit-log records — only platform admins should delete them.

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'compliance_screenings' 
        AND policyname = 'Platform admins delete screenings'
    ) THEN
        CREATE POLICY "Platform admins delete screenings" ON public.compliance_screenings
            FOR DELETE
            USING (
                (SELECT public.is_platform_admin(auth.uid()))
            );
    END IF;
END $$;
