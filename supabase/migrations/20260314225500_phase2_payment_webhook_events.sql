BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'processed',
  error_message TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_payment_webhook_events_provider_event UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_processed_at
ON public.payment_webhook_events(processed_at DESC);

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins view payment webhook events" ON public.payment_webhook_events;
CREATE POLICY "Platform admins view payment webhook events"
ON public.payment_webhook_events
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins manage payment webhook events" ON public.payment_webhook_events;
CREATE POLICY "Platform admins manage payment webhook events"
ON public.payment_webhook_events
FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

DROP TRIGGER IF EXISTS update_payment_webhook_events_updated_at ON public.payment_webhook_events;
CREATE TRIGGER update_payment_webhook_events_updated_at
BEFORE UPDATE ON public.payment_webhook_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT ON public.payment_webhook_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payment_webhook_events TO service_role;

COMMIT;
