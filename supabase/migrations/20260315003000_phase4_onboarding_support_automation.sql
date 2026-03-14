BEGIN;

ALTER TABLE public.tenant_onboarding_sessions
ADD COLUMN IF NOT EXISTS support_status TEXT NOT NULL DEFAULT 'not_required',
ADD COLUMN IF NOT EXISTS support_priority TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS support_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS support_first_response_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS support_resolved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_escalated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS escalation_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS drop_off_risk_score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenant_onboarding_sessions_support_status_check'
  ) THEN
    ALTER TABLE public.tenant_onboarding_sessions
    ADD CONSTRAINT tenant_onboarding_sessions_support_status_check
    CHECK (support_status IN ('not_required', 'open', 'in_progress', 'escalated', 'resolved'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenant_onboarding_sessions_support_priority_check'
  ) THEN
    ALTER TABLE public.tenant_onboarding_sessions
    ADD CONSTRAINT tenant_onboarding_sessions_support_priority_check
    CHECK (support_priority IN ('low', 'medium', 'high', 'critical'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenant_onboarding_sessions_drop_off_risk_check'
  ) THEN
    ALTER TABLE public.tenant_onboarding_sessions
    ADD CONSTRAINT tenant_onboarding_sessions_drop_off_risk_check
    CHECK (drop_off_risk_score >= 0 AND drop_off_risk_score <= 100);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenant_onboarding_sessions_support_status
ON public.tenant_onboarding_sessions(support_status);

CREATE INDEX IF NOT EXISTS idx_tenant_onboarding_sessions_sla_due_at
ON public.tenant_onboarding_sessions(sla_due_at)
WHERE support_status IN ('open', 'in_progress', 'escalated');

CREATE INDEX IF NOT EXISTS idx_tenant_onboarding_sessions_assist_queue
ON public.tenant_onboarding_sessions(status, support_status, support_priority, sla_due_at);

CREATE OR REPLACE FUNCTION public.apply_onboarding_support_automation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'support_assisted' THEN
      NEW.support_status := CASE
        WHEN NEW.support_status = 'resolved' THEN 'open'
        WHEN NEW.support_status = 'not_required' THEN 'open'
        ELSE NEW.support_status
      END;
      NEW.support_requested_at := COALESCE(NEW.support_requested_at, now());
    END IF;
  ELSE
    IF NEW.status = 'support_assisted' AND OLD.status IS DISTINCT FROM 'support_assisted' THEN
      NEW.support_status := CASE
        WHEN NEW.support_status = 'resolved' THEN 'open'
        WHEN NEW.support_status = 'not_required' THEN 'open'
        ELSE NEW.support_status
      END;
      NEW.support_requested_at := COALESCE(NEW.support_requested_at, now());
    END IF;

    IF NEW.support_status IS DISTINCT FROM OLD.support_status THEN
      IF NEW.support_status = 'in_progress' AND NEW.support_first_response_at IS NULL THEN
        NEW.support_first_response_at := now();
      END IF;

      IF NEW.support_status = 'resolved' AND OLD.support_status IS DISTINCT FROM 'resolved' THEN
        NEW.support_resolved_at := now();
      END IF;
    END IF;

    IF NEW.last_escalated_at IS DISTINCT FROM OLD.last_escalated_at AND NEW.last_escalated_at IS NOT NULL THEN
      NEW.escalation_count := COALESCE(OLD.escalation_count, 0) + 1;
    END IF;
  END IF;

  IF NEW.status = 'support_assisted' AND NEW.support_status = 'not_required' THEN
    NEW.support_status := 'open';
  END IF;

  IF NEW.support_status = 'resolved' THEN
    NEW.sla_due_at := NULL;
  ELSIF NEW.status = 'support_assisted' AND NEW.sla_due_at IS NULL THEN
    NEW.sla_due_at := now() + CASE NEW.support_priority
      WHEN 'critical' THEN interval '2 hour'
      WHEN 'high' THEN interval '8 hour'
      ELSE interval '24 hour'
    END;
  END IF;

  NEW.last_activity_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_onboarding_support_automation ON public.tenant_onboarding_sessions;
CREATE TRIGGER apply_onboarding_support_automation
BEFORE INSERT OR UPDATE ON public.tenant_onboarding_sessions
FOR EACH ROW
EXECUTE FUNCTION public.apply_onboarding_support_automation();

COMMIT;
