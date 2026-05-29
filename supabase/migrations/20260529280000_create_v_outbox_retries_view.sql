-- Phase 5 — PostgREST passthrough view for core.outbox_retries.
-- Lets the admin retry queue page inspect failed events, reset retry
-- counters to re-queue them, or flip exhausted events to 'resolved'
-- (dismiss).
--
-- Column-level grants restrict writes to operational metadata only —
-- (outbox_id, tenant_id, max_attempts) stay immutable.

CREATE VIEW public.v_outbox_retries
WITH (security_invoker = true) AS
SELECT * FROM core.outbox_retries;

COMMENT ON VIEW public.v_outbox_retries IS
  'Phase 5 — read+limited-write passthrough for core.outbox_retries. Used by the Retry Queue admin page.';

GRANT SELECT ON public.v_outbox_retries TO authenticated;
GRANT UPDATE (attempt_count, status, next_attempt_at, metadata, last_error) ON public.v_outbox_retries TO authenticated;
GRANT ALL ON public.v_outbox_retries TO service_role;

CREATE POLICY outbox_retries_tenant_update ON core.outbox_retries
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())))
  WITH CHECK (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
