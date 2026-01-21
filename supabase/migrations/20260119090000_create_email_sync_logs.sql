
-- Create email_sync_logs table
CREATE TABLE IF NOT EXISTS public.email_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.email_accounts(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    emails_synced INTEGER DEFAULT 0,
    details JSONB,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_sync_logs ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'email_sync_logs' AND policyname = 'Users can view own sync logs'
    ) THEN
        CREATE POLICY "Users can view own sync logs"
            ON public.email_sync_logs
            FOR SELECT
            USING (
                account_id IN (
                    SELECT id FROM public.email_accounts WHERE user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'email_sync_logs' AND policyname = 'Platform admins can view all sync logs'
    ) THEN
        CREATE POLICY "Platform admins can view all sync logs"
            ON public.email_sync_logs
            FOR SELECT
            USING (is_platform_admin(auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'email_sync_logs' AND policyname = 'Users can insert own sync logs'
    ) THEN
        CREATE POLICY "Users can insert own sync logs"
            ON public.email_sync_logs
            FOR INSERT
            WITH CHECK (
                account_id IN (
                    SELECT id FROM public.email_accounts WHERE user_id = auth.uid()
                )
            );
    END IF;
END
$$;

