-- ==============================================================================
-- UNIVERSAL QUEUE ACCESS FIX
-- Relaxes restrictions to ensure all tenant members can see and access queues.
-- ==============================================================================

-- 1. Redefine get_user_queues to be TENANT-WIDE (removing member restrictions)
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
BEGIN
    -- Reliable Tenant Lookup
    SELECT tenant_id INTO v_tenant_id
    FROM public.user_roles
    WHERE user_id = auth.uid()
    LIMIT 1;

    -- Fallback for testing/admins if not found in roles (optional)
    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

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
    -- REMOVED: Member check. Now all tenant users see all queues.
    GROUP BY q.id, q.name, q.type, q.description
    ORDER BY q.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_queues() TO authenticated;

-- 2. Update RLS for Emails to match (Tenant-Wide Queue Access)
DROP POLICY IF EXISTS "Users can view emails in their queues" ON public.emails;
CREATE POLICY "Users can view emails in their queues"
ON public.emails FOR SELECT
TO authenticated
USING (
  queue IS NOT NULL 
  AND tenant_id = (
    SELECT tenant_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    LIMIT 1
  )
);

-- 3. Update RLS for Queues (Tenant-Wide Visibility)
DROP POLICY IF EXISTS "Users can view queues they are members of" ON public.queues;
CREATE POLICY "Users can view tenant queues"
ON public.queues FOR SELECT
TO authenticated
USING (
  tenant_id = (
    SELECT tenant_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    LIMIT 1
  )
);
