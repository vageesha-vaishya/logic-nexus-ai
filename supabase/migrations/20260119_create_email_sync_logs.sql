
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
CREATE POLICY "Users can view own sync logs"
    ON public.email_sync_logs
    FOR SELECT
    USING (
        account_id IN (
            SELECT id FROM public.email_accounts WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Platform admins can view all sync logs"
    ON public.email_sync_logs
    FOR SELECT
    USING (is_platform_admin(auth.uid()));

-- Allow insert from service role (Edge Functions use service role usually, or user role if passed through)
-- If Edge Function uses user client, user needs INSERT permission.
CREATE POLICY "Users can insert own sync logs"
    ON public.email_sync_logs
    FOR INSERT
    WITH CHECK (
        account_id IN (
            SELECT id FROM public.email_accounts WHERE user_id = auth.uid()
        )
    );

