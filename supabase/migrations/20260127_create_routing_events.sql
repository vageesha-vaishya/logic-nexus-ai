-- Add AI fields to emails table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emails' AND column_name = 'ai_sentiment') THEN
        ALTER TABLE public.emails ADD COLUMN ai_sentiment TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emails' AND column_name = 'ai_urgency') THEN
        ALTER TABLE public.emails ADD COLUMN ai_urgency TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emails' AND column_name = 'intent') THEN
        ALTER TABLE public.emails ADD COLUMN intent TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emails' AND column_name = 'category') THEN
        ALTER TABLE public.emails ADD COLUMN category TEXT;
    END IF;
    -- Add queue column to emails for easier querying
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emails' AND column_name = 'queue') THEN
        ALTER TABLE public.emails ADD COLUMN queue TEXT;
    END IF;
END $$;

-- Create routing_events table
CREATE TABLE IF NOT EXISTS public.routing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
    queue TEXT NOT NULL,
    sla_minutes INTEGER,
    routed_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.routing_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant admins can view routing events"
  ON public.routing_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.emails e
      WHERE e.id = routing_events.email_id
      AND e.tenant_id = get_user_tenant_id(auth.uid())
      AND has_role(auth.uid(), 'tenant_admin')
    )
  );

CREATE POLICY "Users can view routing events for accessible emails"
  ON public.routing_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.emails e
      WHERE e.id = routing_events.email_id
      AND (
          e.account_id IN (SELECT id FROM public.email_accounts WHERE user_id = auth.uid())
          OR
          e.tenant_id = get_user_tenant_id(auth.uid())
      )
    )
  );

CREATE POLICY "Service role can manage all"
  ON public.routing_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to get queue counts
-- Now we can just count from emails table directly which is faster and simpler
CREATE OR REPLACE FUNCTION get_queue_counts()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_object_agg(queue, count)
  FROM (
    SELECT queue, count(*) as count
    FROM emails
    WHERE queue IS NOT NULL
    GROUP BY queue
  ) t;
$$;
