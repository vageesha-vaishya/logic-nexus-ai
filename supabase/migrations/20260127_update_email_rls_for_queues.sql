-- Allow users to view emails assigned to queues they are members of
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
