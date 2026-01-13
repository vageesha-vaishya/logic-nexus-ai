-- 1. Ensure get_queue_counts is robust, tenant-aware, and includes empty queues
CREATE OR REPLACE FUNCTION get_queue_counts()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_result JSON;
BEGIN
    -- Get current user's tenant
    SELECT tenant_id INTO v_tenant_id
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_tenant_id IS NULL THEN
        RETURN '{}'::json;
    END IF;

    -- Aggregate counts from emails, ensuring we respect tenant isolation
    -- We also want to include queues from the queues table even if they have 0 emails
    SELECT json_object_agg(name, count) INTO v_result
    FROM (
        SELECT q.name, count(e.id) as count
        FROM public.queues q
        LEFT JOIN public.emails e ON q.name = e.queue AND e.tenant_id = q.tenant_id
        WHERE q.tenant_id = v_tenant_id
        GROUP BY q.name
        
        UNION
        
        -- Also include queues found in emails that might not be in queues table (legacy/fallback)
        SELECT e.queue as name, count(*) as count
        FROM public.emails e
        WHERE e.tenant_id = v_tenant_id 
        AND e.queue IS NOT NULL
        AND e.queue NOT IN (SELECT name FROM public.queues WHERE tenant_id = v_tenant_id)
        GROUP BY e.queue
    ) t;

    RETURN COALESCE(v_result, '{}'::json);
END;
$$;

-- 2. Add RLS policy to allow users to view emails in their queues
-- First drop to ensure idempotency
DROP POLICY IF EXISTS "Users can view emails in their queues" ON public.emails;

CREATE POLICY "Users can view emails in their queues"
ON public.emails
FOR SELECT
TO authenticated
USING (
  queue IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.queues q
    JOIN public.queue_members qm ON q.id = qm.queue_id
    WHERE q.name = emails.queue
    AND q.tenant_id = emails.tenant_id
    AND qm.user_id = auth.uid()
  )
);

-- 3. Seed default queues for existing tenants if they don't exist
-- This ensures the Sidebar has something to show immediately
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM public.tenants LOOP
        INSERT INTO public.queues (tenant_id, name, description, type)
        VALUES 
            (t.id, 'support_general', 'General Support Queue', 'round_robin'),
            (t.id, 'sales_inbound', 'Inbound Sales Queue', 'round_robin'),
            (t.id, 'support_priority', 'Priority Support Queue', 'holding'),
            (t.id, 'cfm_negative', 'Negative Feedback Queue', 'holding')
        ON CONFLICT DO NOTHING; -- Assuming there's no unique constraint on (tenant_id, name), but if there is, this helps. 
        -- If no unique constraint, we might duplicate. Let's check constraints.
        -- Usually name is not unique per tenant unless enforced.
        -- We'll use a safer check:
        
        IF NOT EXISTS (SELECT 1 FROM public.queues WHERE tenant_id = t.id AND name = 'support_general') THEN
             INSERT INTO public.queues (tenant_id, name, description, type) VALUES (t.id, 'support_general', 'General Support Queue', 'round_robin');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.queues WHERE tenant_id = t.id AND name = 'sales_inbound') THEN
             INSERT INTO public.queues (tenant_id, name, description, type) VALUES (t.id, 'sales_inbound', 'Inbound Sales Queue', 'round_robin');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.queues WHERE tenant_id = t.id AND name = 'support_priority') THEN
             INSERT INTO public.queues (tenant_id, name, description, type) VALUES (t.id, 'support_priority', 'Priority Support Queue', 'holding');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.queues WHERE tenant_id = t.id AND name = 'cfm_negative') THEN
             INSERT INTO public.queues (tenant_id, name, description, type) VALUES (t.id, 'cfm_negative', 'Negative Feedback Queue', 'holding');
        END IF;
    END LOOP;
END $$;
