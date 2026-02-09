-- 1. Create table for tracking individual events (opens, clicks)
CREATE TABLE IF NOT EXISTS public.email_tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('open', 'click')),
    url TEXT, -- Only for clicks
    ip_address TEXT,
    user_agent TEXT,
    location JSONB, -- GeoIP data
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_tracking_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Service role can insert events (Edge Functions)
CREATE POLICY "Service role can manage tracking events"
    ON public.email_tracking_events
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Users can view tracking events for emails they have access to
CREATE POLICY "Users can view tracking events"
    ON public.email_tracking_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.emails e
            WHERE e.id = email_tracking_events.email_id
            AND (
                -- Standard email visibility logic (simplified for tracking events)
                e.user_id = auth.uid()
                OR e.account_id IN (SELECT id FROM public.email_accounts WHERE user_id = auth.uid())
                OR (public.is_tenant_admin(auth.uid()) AND e.tenant_id = public.get_user_tenant_id(auth.uid()))
            )
        )
    );

-- 2. Add aggregate columns to emails table for fast lookup
ALTER TABLE public.emails 
ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMPTZ;

-- 3. Create function to update aggregates on new event
CREATE OR REPLACE FUNCTION public.update_email_tracking_aggregates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.event_type = 'open' THEN
        UPDATE public.emails
        SET 
            open_count = open_count + 1,
            last_opened_at = NEW.created_at
        WHERE id = NEW.email_id;
    ELSIF NEW.event_type = 'click' THEN
        UPDATE public.emails
        SET 
            click_count = click_count + 1,
            last_clicked_at = NEW.created_at
        WHERE id = NEW.email_id;
    END IF;
    RETURN NEW;
END;
$$;

-- 4. Create trigger
DROP TRIGGER IF EXISTS trg_update_email_tracking ON public.email_tracking_events;
CREATE TRIGGER trg_update_email_tracking
AFTER INSERT ON public.email_tracking_events
FOR EACH ROW
EXECUTE FUNCTION public.update_email_tracking_aggregates();
