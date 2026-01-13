-- Function to get user queues with counts
-- This is required by EmailClient.tsx and useQueueManagement.ts
-- It joins queues with emails to get accurate counts per queue for the current tenant

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
    -- Get current user's tenant
    v_tenant_id := public.get_user_tenant_id(auth.uid());

    -- Fallback if get_user_tenant_id returns null (try user_roles directly)
    IF v_tenant_id IS NULL THEN
        SELECT tenant_id INTO v_tenant_id
        FROM public.user_roles
        WHERE user_id = auth.uid()
        LIMIT 1;
    END IF;

    -- If still no tenant, return empty
    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    -- Check if user is tenant admin
    v_is_admin := public.has_role(auth.uid(), 'tenant_admin'::public.app_role);

    RETURN QUERY
    SELECT 
        q.id as queue_id,
        q.name as queue_name,
        q.type::text as queue_type, -- Cast enum/text to text to be safe
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_queues() TO authenticated;
