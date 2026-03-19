BEGIN;
ALTER TABLE public.self_service_onboarding_requests
ADD COLUMN IF NOT EXISTS plan_id UUID;
ALTER TABLE public.self_service_onboarding_requests
DROP CONSTRAINT IF EXISTS self_service_onboarding_requests_plan_tier_check;
ALTER TABLE public.self_service_onboarding_requests
DROP CONSTRAINT IF EXISTS self_service_onboarding_requests_plan_id_fkey;
ALTER TABLE public.self_service_onboarding_requests
ADD CONSTRAINT self_service_onboarding_requests_plan_id_fkey
FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_self_service_onboarding_requests_plan_id
ON public.self_service_onboarding_requests(plan_id);
WITH ranked_plans AS (
  SELECT
    id,
    LOWER(tier::text) AS tier,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(tier::text)
      ORDER BY sort_order NULLS LAST, price_monthly NULLS LAST, id
    ) AS row_num
  FROM public.subscription_plans
  WHERE is_active = true
)
UPDATE public.self_service_onboarding_requests AS req
SET plan_id = ranked_plans.id
FROM ranked_plans
WHERE req.plan_id IS NULL
  AND LOWER(req.plan_tier) = ranked_plans.tier
  AND ranked_plans.row_num = 1;
COMMIT;
