-- ==============================================================================
-- COMPLETE FIX FOR EMAIL QUEUES
-- This script applies all necessary database changes to fix queue display and filtering.
-- Run this script in your Supabase SQL Editor.
-- ==============================================================================

-- 1. Create Queue Rules Table
CREATE TABLE IF NOT EXISTS public.queue_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 0,
    criteria JSONB NOT NULL,
    target_queue_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_rules_tenant_priority ON public.queue_rules(tenant_id, priority DESC);
ALTER TABLE public.queue_rules ENABLE ROW LEVEL SECURITY;

-- 2. Create Queue Members Table
CREATE TABLE IF NOT EXISTS public.queue_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id UUID NOT NULL REFERENCES public.queues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(queue_id, user_id)
);
ALTER TABLE public.queue_members ENABLE ROW LEVEL SECURITY;

-- 3. Auto-Assignment Function & Trigger
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
    IF NEW.queue IS NOT NULL THEN
        RETURN NEW;
    END IF;

    FOR rule IN 
        SELECT * FROM public.queue_rules 
        WHERE tenant_id = NEW.tenant_id 
        AND is_active = true 
        ORDER BY priority DESC
    LOOP
        criteria := rule.criteria;
        match_found := TRUE;

        IF criteria ? 'subject_contains' AND 
           NOT (NEW.subject ILIKE '%' || (criteria->>'subject_contains') || '%') THEN
            match_found := FALSE;
        END IF;

        IF match_found AND criteria ? 'from_email' AND 
           NOT (NEW.from_address ILIKE (criteria->>'from_email')) THEN
            match_found := FALSE;
        END IF;
        
        IF match_found THEN
            NEW.queue := rule.target_queue_name;
            RETURN NEW;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_email_queue ON public.emails;
CREATE TRIGGER trg_assign_email_queue
    BEFORE INSERT ON public.emails
    FOR EACH ROW
    EXECUTE FUNCTION public.process_email_queue_assignment();

-- 4. CRITICAL: The Missing 'get_user_queues' Function
CREATE OR REPLACE FUNCTION public.get_user_queues()
RETURNS TABLE (
    queue_id UUID,
    queue_name TEXT,
    queue_type TEXT,
    description TEXT,
    email_count BIGINT,
    unread_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    v_tenant_id := public.get_user_tenant_id(auth.uid());
    
    IF v_tenant_id IS NULL THEN
        SELECT tenant_id INTO v_tenant_id
        FROM public.user_roles
        WHERE user_id = auth.uid()
        LIMIT 1;
    END IF;

    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    v_is_admin := public.has_role(auth.uid(), 'tenant_admin'::public.app_role);

    RETURN QUERY
    SELECT 
        q.id as queue_id,
        q.name as queue_name,
        q.type::text as queue_type,
        q.description,
        COUNT(e.id)::BIGINT as email_count,
        COUNT(CASE WHEN e.is_read = false THEN 1 END)::BIGINT as unread_count
    FROM public.queues q
    LEFT JOIN public.emails e ON q.name = e.queue AND e.tenant_id = q.tenant_id
    WHERE q.tenant_id = v_tenant_id
    AND (
        v_is_admin 
        OR EXISTS (
            SELECT 1 FROM public.queue_members qm
            WHERE qm.queue_id = q.id AND qm.user_id = auth.uid()
        )
    )
    GROUP BY q.id, q.name, q.type, q.description
    ORDER BY q.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_queues() TO authenticated;

-- 5. RLS Policies
-- Queue Rules
DROP POLICY IF EXISTS "Tenant admins can manage queue rules" ON public.queue_rules;
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

-- Queues
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view queues they are members of" ON public.queues;
CREATE POLICY "Users can view queues they are members of"
ON public.queues FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.queue_members qm
    WHERE qm.queue_id = id AND qm.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'tenant_admin'::public.app_role)
);

-- Emails (Queue Visibility)
DROP POLICY IF EXISTS "Users can view emails in their queues" ON public.emails;
CREATE POLICY "Users can view emails in their queues"
ON public.emails FOR SELECT
TO authenticated
USING (
  queue IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.queues q
      JOIN public.queue_members qm ON q.id = qm.queue_id
      WHERE q.name = emails.queue
      AND q.tenant_id = emails.tenant_id
      AND qm.user_id = auth.uid()
    )
    OR
    (
      public.has_role(auth.uid(), 'tenant_admin'::public.app_role) 
      AND emails.tenant_id = public.get_user_tenant_id(auth.uid())
    )
  )
);

-- 6. Seed Data (Idempotent)
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

        -- Seed Sample Rule
        INSERT INTO public.queue_rules (tenant_id, name, description, criteria, target_queue_name, priority)
        VALUES 
            (t.id, 'Detect Urgent', 'Routes urgent emails to priority support', '{"subject_contains": "urgent"}', 'support_priority', 10)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;
