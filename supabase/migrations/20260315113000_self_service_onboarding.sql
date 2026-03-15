BEGIN;

CREATE TABLE IF NOT EXISTS public.self_service_onboarding_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'pending_verification',
    organization_name TEXT NOT NULL,
    organization_slug TEXT NOT NULL,
    admin_email TEXT NOT NULL,
    admin_first_name TEXT NOT NULL,
    admin_last_name TEXT,
    country TEXT NOT NULL,
    plan_tier TEXT NOT NULL,
    billing_period TEXT NOT NULL DEFAULT 'monthly',
    currency TEXT NOT NULL DEFAULT 'USD',
    requested_user_count INTEGER NOT NULL DEFAULT 2,
    requested_franchise_count INTEGER NOT NULL DEFAULT 1,
    data_residency TEXT NOT NULL,
    captcha_provider TEXT,
    captcha_score NUMERIC(5,2),
    verification_code_hash TEXT NOT NULL,
    verification_expires_at TIMESTAMPTZ NOT NULL,
    verification_attempt_count INTEGER NOT NULL DEFAULT 0,
    verification_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at TIMESTAMPTZ,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    onboarding_session_id UUID REFERENCES public.tenant_onboarding_sessions(id) ON DELETE SET NULL,
    ip_address TEXT,
    user_agent TEXT,
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'self_service_onboarding_requests_status_check'
  ) THEN
    ALTER TABLE public.self_service_onboarding_requests
    ADD CONSTRAINT self_service_onboarding_requests_status_check
    CHECK (status IN ('pending_verification', 'email_verified', 'provisioning', 'completed', 'failed', 'expired'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'self_service_onboarding_requests_plan_tier_check'
  ) THEN
    ALTER TABLE public.self_service_onboarding_requests
    ADD CONSTRAINT self_service_onboarding_requests_plan_tier_check
    CHECK (plan_tier IN ('free', 'professional', 'enterprise'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'self_service_onboarding_requests_billing_period_check'
  ) THEN
    ALTER TABLE public.self_service_onboarding_requests
    ADD CONSTRAINT self_service_onboarding_requests_billing_period_check
    CHECK (billing_period IN ('monthly', 'annual'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_self_service_onboarding_requests_status
ON public.self_service_onboarding_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_self_service_onboarding_requests_admin_email
ON public.self_service_onboarding_requests(admin_email);

CREATE INDEX IF NOT EXISTS idx_self_service_onboarding_requests_verification_expires_at
ON public.self_service_onboarding_requests(verification_expires_at);

CREATE TABLE IF NOT EXISTS public.self_service_onboarding_rate_limits (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    blocked_until TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'self_service_onboarding_rate_limits_scope_check'
  ) THEN
    ALTER TABLE public.self_service_onboarding_rate_limits
    ADD CONSTRAINT self_service_onboarding_rate_limits_scope_check
    CHECK (scope IN ('ip', 'email'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_self_service_onboarding_rate_limits_scope
ON public.self_service_onboarding_rate_limits(scope, blocked_until);

ALTER TABLE public.self_service_onboarding_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.self_service_onboarding_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages self service onboarding requests" ON public.self_service_onboarding_requests;
CREATE POLICY "Service role manages self service onboarding requests"
ON public.self_service_onboarding_requests
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages self service onboarding rate limits" ON public.self_service_onboarding_rate_limits;
CREATE POLICY "Service role manages self service onboarding rate limits"
ON public.self_service_onboarding_rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP TRIGGER IF EXISTS update_self_service_onboarding_requests_updated_at ON public.self_service_onboarding_requests;
CREATE TRIGGER update_self_service_onboarding_requests_updated_at
BEFORE UPDATE ON public.self_service_onboarding_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_self_service_onboarding_rate_limits_updated_at ON public.self_service_onboarding_rate_limits;
CREATE TRIGGER update_self_service_onboarding_rate_limits_updated_at
BEFORE UPDATE ON public.self_service_onboarding_rate_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE ON public.self_service_onboarding_requests TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.self_service_onboarding_rate_limits TO service_role;

COMMIT;
