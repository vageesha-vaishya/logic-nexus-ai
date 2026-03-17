BEGIN;

ALTER TABLE public.self_service_onboarding_requests
DROP CONSTRAINT IF EXISTS self_service_onboarding_requests_status_check;

ALTER TABLE public.self_service_onboarding_requests
ADD CONSTRAINT self_service_onboarding_requests_status_check
CHECK (
  status IN (
    'pending_verification',
    'email_verified',
    'approved',
    'rejected',
    'in_progress',
    'provisioning',
    'completed',
    'failed',
    'expired'
  )
);

CREATE INDEX IF NOT EXISTS idx_self_service_onboarding_requests_status_updated
ON public.self_service_onboarding_requests(status, updated_at DESC);

DROP POLICY IF EXISTS "Platform admins can view self service onboarding requests" ON public.self_service_onboarding_requests;
CREATE POLICY "Platform admins can view self service onboarding requests"
ON public.self_service_onboarding_requests
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

COMMIT;
