BEGIN;

UPDATE public.self_service_onboarding_requests
SET admin_email = lower(trim(admin_email))
WHERE admin_email <> lower(trim(admin_email));

WITH ranked_duplicates AS (
  SELECT
    id,
    admin_email,
    ROW_NUMBER() OVER (
      PARTITION BY admin_email
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS row_num
  FROM public.self_service_onboarding_requests
),
duplicate_rows AS (
  SELECT id
  FROM ranked_duplicates
  WHERE row_num > 1
)
UPDATE public.self_service_onboarding_requests req
SET
  admin_email = 'superseded+' || req.id::text || '+' || req.admin_email,
  failure_reason = COALESCE(req.failure_reason || ' | ', '') || 'Superseded duplicate admin_email during uniqueness migration',
  updated_at = now()
FROM duplicate_rows d
WHERE req.id = d.id;

ALTER TABLE public.self_service_onboarding_requests
DROP CONSTRAINT IF EXISTS self_service_onboarding_requests_admin_email_unique;

ALTER TABLE public.self_service_onboarding_requests
ADD CONSTRAINT self_service_onboarding_requests_admin_email_unique UNIQUE (admin_email);

COMMIT;
