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
DROP POLICY IF EXISTS "Tenant admins can view routing events" ON public.routing_events;
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

DROP POLICY IF EXISTS "Users can view routing events for accessible emails" ON public.routing_events;
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

DROP POLICY IF EXISTS "Service role can manage all" ON public.routing_events;
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

-- BACKFILL LOGIC FOR EXISTING EMAILS
DO $$
DECLARE
    r RECORD;
    v_category TEXT;
    v_sentiment TEXT;
    v_intent TEXT;
    v_queue TEXT;
    v_sla INTEGER;
    v_combined TEXT;
BEGIN
    FOR r IN SELECT id, subject, body_text FROM emails WHERE queue IS NULL LOOP
        v_combined := LOWER(COALESCE(r.subject, '') || ' ' || COALESCE(r.body_text, ''));
        
        -- 1. Classification
        -- Category
        IF v_combined LIKE '%feedback%' OR v_combined LIKE '%survey%' OR v_combined LIKE '%nps%' THEN
            v_category := 'feedback';
        ELSIF v_combined LIKE '%support%' OR v_combined LIKE '%help%' OR v_combined LIKE '%issue%' OR v_combined LIKE '%quote%' THEN
            v_category := 'crm';
        ELSE
            v_category := 'non_crm';
        END IF;

        -- Sentiment
        IF v_combined LIKE '%angry%' OR v_combined LIKE '%upset%' OR v_combined LIKE '%terrible%' OR v_combined LIKE '%worst%' THEN
            v_sentiment := 'very_negative';
        ELSIF v_combined LIKE '%bad%' OR v_combined LIKE '%poor%' OR v_combined LIKE '%disappointed%' THEN
            v_sentiment := 'negative';
        ELSIF v_combined LIKE '%great%' OR v_combined LIKE '%excellent%' OR v_combined LIKE '%love%' THEN
            v_sentiment := 'positive';
        ELSE
            v_sentiment := 'neutral';
        END IF;

        -- Intent
        IF v_combined LIKE '%price%' OR v_combined LIKE '%cost%' OR v_combined LIKE '%buy%' OR v_combined LIKE '%purchase%' THEN
            v_intent := 'sales';
        ELSIF v_combined LIKE '%broken%' OR v_combined LIKE '%error%' OR v_combined LIKE '%bug%' OR v_combined LIKE '%fail%' THEN
            v_intent := 'support';
        ELSE
            v_intent := 'other';
        END IF;

        -- 2. Routing
        v_queue := 'support_general';
        v_sla := 60;

        IF v_category = 'feedback' AND (v_sentiment = 'negative' OR v_sentiment = 'very_negative') THEN
            v_queue := 'cfm_negative';
            v_sla := 30;
        ELSIF v_category = 'crm' AND v_sentiment = 'very_negative' THEN
            v_queue := 'support_priority';
            v_sla := 15;
        ELSIF v_intent = 'sales' THEN
            v_queue := 'sales_inbound';
            v_sla := 120;
        END IF;

        -- 3. Update Email
        UPDATE emails 
        SET 
            category = v_category,
            ai_sentiment = v_sentiment,
            intent = v_intent,
            queue = v_queue,
            ai_urgency = CASE WHEN v_sla <= 30 THEN 'high' ELSE 'medium' END
        WHERE id = r.id;

        -- 4. Insert Routing Event
        INSERT INTO routing_events (email_id, queue, sla_minutes, metadata)
        VALUES (r.id, v_queue, v_sla, jsonb_build_object('source', 'backfill'));
        
    END LOOP;
END $$;
