-- =============================================
-- QUEUE FILTERING & PERMISSION SYSTEM
-- Complete implementation for email queue management
-- =============================================

-- 1. Create queue_rules table for auto-categorization
CREATE TABLE IF NOT EXISTS public.queue_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    -- queue_id might be missing if table existed from old schema
    name TEXT NOT NULL,
    description TEXT,
    criteria JSONB NOT NULL DEFAULT '{}',
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(tenant_id, name)
);

-- Ensure queue_id column exists (schema migration)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'queue_rules' AND column_name = 'queue_id') THEN
        -- Add as nullable first
        ALTER TABLE public.queue_rules ADD COLUMN queue_id UUID REFERENCES public.queues(id) ON DELETE CASCADE;
        
        -- Migrate data if target_queue_name exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'queue_rules' AND column_name = 'target_queue_name') THEN
             UPDATE public.queue_rules qr
             SET queue_id = q.id
             FROM public.queues q
             WHERE qr.target_queue_name = q.name AND qr.tenant_id = q.tenant_id;
        END IF;

        -- Remove invalid rows (safety for NOT NULL constraint)
        DELETE FROM public.queue_rules WHERE queue_id IS NULL;
        
        -- Set NOT NULL
        ALTER TABLE public.queue_rules ALTER COLUMN queue_id SET NOT NULL;
    END IF;
END $$;

-- 2. Create index for efficient rule evaluation
CREATE INDEX IF NOT EXISTS idx_queue_rules_tenant_priority 
    ON public.queue_rules(tenant_id, priority DESC) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_queue_rules_queue_id 
    ON public.queue_rules(queue_id);

-- 3. Add tenant_id to queue_members if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'queue_members' 
        AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE public.queue_members 
        ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    END IF;
END $$;

-- 4. Enable RLS on queue_rules
ALTER TABLE public.queue_rules ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for queue_rules (tenant admin only)
DROP POLICY IF EXISTS "Tenant admins can manage queue rules" ON public.queue_rules;
CREATE POLICY "Tenant admins can manage queue rules"
ON public.queue_rules
FOR ALL
TO authenticated
USING (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
    )
    AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'tenant_admin'
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
    )
    AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'tenant_admin'
    )
);

-- 6. RLS policies for queue_members
ALTER TABLE public.queue_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their queue memberships" ON public.queue_members;
CREATE POLICY "Users can view their queue memberships"
ON public.queue_members
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'tenant_admin'
    )
);

DROP POLICY IF EXISTS "Tenant admins can manage queue memberships" ON public.queue_members;
CREATE POLICY "Tenant admins can manage queue memberships"
ON public.queue_members
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'tenant_admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'tenant_admin'
    )
);

-- 7. RLS policies for queues table
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view queues in their tenant" ON public.queues;
CREATE POLICY "Users can view queues in their tenant"
ON public.queues
FOR SELECT
TO authenticated
USING (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Tenant admins can manage queues" ON public.queues;
CREATE POLICY "Tenant admins can manage queues"
ON public.queues
FOR ALL
TO authenticated
USING (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
    )
    AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'tenant_admin'
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
    )
    AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'tenant_admin'
    )
);

-- 8. Create function to evaluate queue rules and assign queue
CREATE OR REPLACE FUNCTION public.process_email_queue_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rule RECORD;
    v_criteria JSONB;
    v_match BOOLEAN;
    v_queue_name TEXT;
BEGIN
    -- Only process if queue is not already set
    IF NEW.queue IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Get tenant_id from email
    IF NEW.tenant_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Iterate through active rules ordered by priority (highest first)
    FOR v_rule IN 
        SELECT qr.criteria, q.name as queue_name
        FROM public.queue_rules qr
        JOIN public.queues q ON q.id = qr.queue_id
        WHERE qr.tenant_id = NEW.tenant_id
        AND qr.is_active = true
        ORDER BY qr.priority DESC
    LOOP
        v_criteria := v_rule.criteria;
        v_match := true;

        -- Check subject_contains
        IF v_criteria ? 'subject_contains' THEN
            IF NEW.subject IS NULL OR 
               NOT (NEW.subject ILIKE '%' || (v_criteria->>'subject_contains') || '%') THEN
                v_match := false;
            END IF;
        END IF;

        -- Check from_email (exact match, case insensitive)
        IF v_match AND v_criteria ? 'from_email' THEN
            IF NEW.from_email IS NULL OR 
               LOWER(NEW.from_email) != LOWER(v_criteria->>'from_email') THEN
                v_match := false;
            END IF;
        END IF;

        -- Check from_domain
        IF v_match AND v_criteria ? 'from_domain' THEN
            IF NEW.from_email IS NULL OR 
               NOT (LOWER(NEW.from_email) LIKE '%@' || LOWER(v_criteria->>'from_domain')) THEN
                v_match := false;
            END IF;
        END IF;

        -- Check body_contains
        IF v_match AND v_criteria ? 'body_contains' THEN
            IF (NEW.body_text IS NULL OR 
               NOT (NEW.body_text ILIKE '%' || (v_criteria->>'body_contains') || '%'))
               AND (NEW.body_html IS NULL OR 
               NOT (NEW.body_html ILIKE '%' || (v_criteria->>'body_contains') || '%')) THEN
                v_match := false;
            END IF;
        END IF;

        -- Check priority
        IF v_match AND v_criteria ? 'priority' THEN
            IF NEW.priority IS NULL OR 
               LOWER(NEW.priority) != LOWER(v_criteria->>'priority') THEN
                v_match := false;
            END IF;
        END IF;

        -- Check ai_category
        IF v_match AND v_criteria ? 'ai_category' THEN
            IF NEW.ai_category IS NULL OR 
               LOWER(NEW.ai_category) != LOWER(v_criteria->>'ai_category') THEN
                v_match := false;
            END IF;
        END IF;

        -- Check ai_sentiment
        IF v_match AND v_criteria ? 'ai_sentiment' THEN
            IF NEW.ai_sentiment IS NULL OR 
               LOWER(NEW.ai_sentiment) != LOWER(v_criteria->>'ai_sentiment') THEN
                v_match := false;
            END IF;
        END IF;

        -- If all criteria matched, assign queue and stop processing
        IF v_match THEN
            NEW.queue := v_rule.queue_name;
            RETURN NEW;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

-- 9. Create trigger for auto-assignment
DROP TRIGGER IF EXISTS trg_assign_email_queue ON public.emails;
CREATE TRIGGER trg_assign_email_queue
    BEFORE INSERT ON public.emails
    FOR EACH ROW
    EXECUTE FUNCTION public.process_email_queue_assignment();

-- 10. Create function to manually assign email to queue
CREATE OR REPLACE FUNCTION public.assign_email_to_queue(
    p_email_id UUID,
    p_queue_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_has_access BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    -- Get tenant_id from user_roles
    SELECT ur.tenant_id INTO v_tenant_id
    FROM public.user_roles ur
    WHERE ur.user_id = v_user_id
    LIMIT 1;

    -- Verify queue exists and user has access
    SELECT EXISTS (
        SELECT 1 FROM public.queues q
        JOIN public.queue_members qm ON q.id = qm.queue_id
        WHERE q.name = p_queue_name
        AND q.tenant_id = v_tenant_id
        AND qm.user_id = v_user_id
    ) INTO v_has_access;

    -- Also allow tenant admins
    IF NOT v_has_access THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = v_user_id
            AND ur.role = 'tenant_admin'
        ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Access denied: User does not have access to queue %', p_queue_name;
    END IF;

    -- Update email queue
    UPDATE public.emails
    SET queue = p_queue_name,
        updated_at = now()
    WHERE id = p_email_id
    AND tenant_id = v_tenant_id;

    -- Log the action
    INSERT INTO public.email_audit_log (
        email_id,
        event_type,
        event_data,
        user_id,
        tenant_id
    ) VALUES (
        p_email_id,
        'queue_assignment',
        jsonb_build_object('queue', p_queue_name, 'assigned_by', v_user_id),
        v_user_id,
        v_tenant_id
    );

    RETURN true;
END;
$$;

-- 11. Create function to get user's accessible queues
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
    v_user_id UUID;
    v_tenant_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    -- Get tenant_id from user_roles
    SELECT ur.tenant_id INTO v_tenant_id
    FROM public.user_roles ur
    WHERE ur.user_id = v_user_id
    LIMIT 1;

    -- Check if user is tenant admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = v_user_id
        AND ur.role = 'tenant_admin'
    ) INTO v_is_admin;

    RETURN QUERY
    SELECT 
        q.id as queue_id,
        q.name as queue_name,
        q.type as queue_type,
        q.description,
        COUNT(e.id) as email_count,
        COUNT(e.id) FILTER (WHERE e.is_read = false) as unread_count
    FROM public.queues q
    LEFT JOIN public.emails e ON q.name = e.queue AND q.tenant_id = e.tenant_id
    WHERE q.tenant_id = v_tenant_id
    AND q.is_active = true
    AND (
        v_is_admin = true
        OR EXISTS (
            SELECT 1 FROM public.queue_members qm
            WHERE qm.queue_id = q.id
            AND qm.user_id = v_user_id
        )
    )
    GROUP BY q.id, q.name, q.type, q.description;
END;
$$;

-- 12. Update updated_at trigger for queue_rules
CREATE OR REPLACE FUNCTION public.update_queue_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_queue_rules_updated_at ON public.queue_rules;
CREATE TRIGGER update_queue_rules_updated_at
    BEFORE UPDATE ON public.queue_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_queue_rules_updated_at();

-- 13. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.assign_email_to_queue(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_queues() TO authenticated;