
-- 1. Add queue column to emails table
ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS queue TEXT;

-- 2. Create index for queue lookups
CREATE INDEX IF NOT EXISTS idx_emails_queue ON public.emails(queue);
CREATE INDEX IF NOT EXISTS idx_emails_queue_tenant ON public.emails(queue, tenant_id);

-- 3. Create get_queue_counts function
CREATE OR REPLACE FUNCTION public.get_queue_counts()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_result JSON;
BEGIN
    SELECT tenant_id INTO v_tenant_id
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_tenant_id IS NULL THEN
        RETURN '{}'::json;
    END IF;

    SELECT json_object_agg(name, COALESCE(count, 0)) INTO v_result
    FROM (
        SELECT q.name, count(e.id) as count
        FROM public.queues q
        LEFT JOIN public.emails e ON q.name = e.queue AND e.tenant_id = q.tenant_id
        WHERE q.tenant_id = v_tenant_id
        GROUP BY q.name
    ) t;

    RETURN COALESCE(v_result, '{}'::json);
END;
$$;

-- 4. Add RLS policy for queue emails
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
