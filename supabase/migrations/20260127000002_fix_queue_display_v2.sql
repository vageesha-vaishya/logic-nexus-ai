-- ==============================================================================
-- STRICT QUEUE SYSTEM IMPLEMENTATION
-- 1. Queue Rules & Auto-Assignment
-- 2. Strict RLS Enforcement (Emails & Queues)
-- 3. Robust Queue Counts
-- ==============================================================================

-- 1. Create Queue Assignment Rules Table
CREATE TABLE IF NOT EXISTS public.queue_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 0, -- Higher number = higher priority
    criteria JSONB NOT NULL, -- e.g., {"subject_contains": "urgent", "from_domain": "vip.com"}
    target_queue_name TEXT NOT NULL, -- Target queue name (must exist in queues table)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_queue_rules_tenant_priority ON public.queue_rules(tenant_id, priority DESC);

-- Enable RLS on rules
ALTER TABLE public.queue_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage queue rules" ON public.queue_rules
    FOR ALL
    USING (
        public.has_role(auth.uid(), 'tenant_admin'::public.app_role) 
        AND tenant_id = public.get_user_tenant_id(auth.uid())
    )
    WITH CHECK (
        public.has_role(auth.uid(), 'tenant_admin'::public.app_role) 
        AND tenant_id = public.get_user_tenant_id(auth.uid())
    );

-- 2. Auto-Assignment Function
CREATE OR REPLACE FUNCTION public.process_email_queue_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rule RECORD;
    criteria JSONB;
    match_found BOOLEAN;
BEGIN
    -- Only process if queue is not already set
    IF NEW.queue IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Iterate through active rules for this tenant, ordered by priority
    FOR rule IN 
        SELECT * FROM public.queue_rules 
        WHERE tenant_id = NEW.tenant_id 
        AND is_active = true 
        ORDER BY priority DESC
    LOOP
        criteria := rule.criteria;
        match_found := TRUE;

        -- Check Subject
        IF criteria ? 'subject_contains' AND 
           NOT (NEW.subject ILIKE '%' || (criteria->>'subject_contains') || '%') THEN
            match_found := FALSE;
        END IF;

        -- Check From Email
        IF match_found AND criteria ? 'from_email' AND 
           NOT (NEW.from_address ILIKE (criteria->>'from_email')) THEN
            match_found := FALSE;
        END IF;
        
        -- Check Body (if available)
        IF match_found AND criteria ? 'body_contains' AND 
           NOT (COALESCE(NEW.body_text, '') ILIKE '%' || (criteria->>'body_contains') || '%') THEN
            match_found := FALSE;
        END IF;

        -- If all criteria match, assign queue and exit
        IF match_found THEN
            NEW.queue := rule.target_queue_name;
            -- Optionally log/tag
            RETURN NEW;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

-- 3. Attach Trigger to Emails
DROP TRIGGER IF EXISTS trg_assign_email_queue ON public.emails;
CREATE TRIGGER trg_assign_email_queue
    BEFORE INSERT ON public.emails
    FOR EACH ROW
    EXECUTE FUNCTION public.process_email_queue_assignment();


-- 4. Robust Get Queue Counts (Updated)
CREATE OR REPLACE FUNCTION get_queue_counts()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_result JSON;
BEGIN
    v_tenant_id := public.get_user_tenant_id(auth.uid());

    -- Fallback mechanism for tenant ID
    IF v_tenant_id IS NULL THEN
        SELECT tenant_id INTO v_tenant_id
        FROM public.user_roles
        WHERE user_id = auth.uid()
        LIMIT 1;
    END IF;

    IF v_tenant_id IS NULL THEN
        RETURN '{}'::json;
    END IF;

    -- Aggregate counts:
    -- 1. Start with ALL queues defined for the tenant (so we get 0 counts)
    -- 2. Join with emails that match queue AND user has access to
    SELECT json_object_agg(name, count) INTO v_result
    FROM (
        SELECT q.name, COUNT(e.id) as count
        FROM public.queues q
        LEFT JOIN public.emails e ON q.name = e.queue 
            AND e.tenant_id = q.tenant_id
            -- STRICT VISIBILITY CHECK IN COUNTING:
            -- Only count emails if the user is a member of the queue OR is an admin
            AND (
                EXISTS (
                    SELECT 1 FROM public.queue_members qm 
                    WHERE qm.queue_id::uuid = q.id::uuid AND qm.user_id::uuid = auth.uid()
                )
                OR public.has_role(auth.uid(), 'tenant_admin'::public.app_role)
            )
        WHERE q.tenant_id = v_tenant_id
        GROUP BY q.name
    ) t;

    RETURN COALESCE(v_result, '{}'::json);
END;
$$;

-- 5. Strict RLS Policy for Email Queues
DROP POLICY IF EXISTS "Users can view emails in their queues" ON public.emails;

CREATE POLICY "Users can view emails in their queues"
ON public.emails
FOR SELECT
TO authenticated
USING (
  queue IS NOT NULL AND (
    -- STRICT: User MUST be a member of the queue
    EXISTS (
      SELECT 1 FROM public.queues q
      JOIN public.queue_members qm ON q.id = qm.queue_id
      WHERE q.name = emails.queue
      AND q.tenant_id = emails.tenant_id
      AND qm.user_id = auth.uid()
    )
    OR
    -- OR User is a tenant admin
    (
      public.has_role(auth.uid(), 'tenant_admin'::public.app_role) 
      AND emails.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  )
);

-- 6. Ensure Queue Members Table Exists & RLS
CREATE TABLE IF NOT EXISTS public.queue_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id UUID NOT NULL REFERENCES public.queues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(queue_id, user_id)
);

ALTER TABLE public.queue_members ENABLE ROW LEVEL SECURITY;

-- 7. Ensure Queues Table RLS (Strict Visibility)
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view queues they are members of" ON public.queues;
CREATE POLICY "Users can view queues they are members of"
ON public.queues FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.queue_members qm
    WHERE qm.queue_id::uuid = id::uuid AND qm.user_id::uuid = auth.uid()
  )
  OR public.has_role(auth.uid(), 'tenant_admin'::public.app_role)
);


-- 8. Seed Default Queues and Rules (Idempotent)
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM public.tenants LOOP
        -- Seed Queues
        INSERT INTO public.queues (tenant_id, name, description, type)
        VALUES 
            (t.id, 'support_general', 'General Support Queue', 'round_robin'),
            (t.id, 'sales_inbound', 'Inbound Sales Queue', 'round_robin'),
            (t.id, 'support_priority', 'Priority Support Queue', 'holding'),
            (t.id, 'cfm_negative', 'Negative Feedback Queue', 'holding')
        ON CONFLICT DO NOTHING;

        -- Seed Sample Rule (Priority Support)
        INSERT INTO public.queue_rules (tenant_id, name, description, criteria, target_queue_name, priority)
        VALUES 
            (t.id, 'Detect Urgent', 'Routes urgent emails to priority support', '{"subject_contains": "urgent"}', 'support_priority', 10)
        ON CONFLICT DO NOTHING; -- Assuming ID won't conflict, but this is safe for new entries
    END LOOP;
END $$;
