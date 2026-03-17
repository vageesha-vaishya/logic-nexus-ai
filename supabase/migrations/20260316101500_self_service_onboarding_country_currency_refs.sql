BEGIN;

ALTER TABLE public.self_service_onboarding_requests
  ADD COLUMN IF NOT EXISTS country_id UUID,
  ADD COLUMN IF NOT EXISTS currency_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'self_service_onboarding_requests_country_id_fkey'
  ) THEN
    ALTER TABLE public.self_service_onboarding_requests
      ADD CONSTRAINT self_service_onboarding_requests_country_id_fkey
      FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE RESTRICT;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'self_service_onboarding_requests_currency_id_fkey'
  ) THEN
    ALTER TABLE public.self_service_onboarding_requests
      ADD CONSTRAINT self_service_onboarding_requests_currency_id_fkey
      FOREIGN KEY (currency_id) REFERENCES public.currencies(id) ON DELETE RESTRICT;
  END IF;
END $$;
UPDATE public.self_service_onboarding_requests request_row
SET country_id = country_row.id
FROM public.countries country_row
WHERE request_row.country_id IS NULL
  AND upper(trim(coalesce(request_row.country, ''))) = upper(trim(coalesce(country_row.code_iso2, '')));
UPDATE public.self_service_onboarding_requests request_row
SET country_id = country_row.id
FROM public.countries country_row
WHERE request_row.country_id IS NULL
  AND upper(trim(coalesce(request_row.country, ''))) = upper(trim(coalesce(country_row.name, '')));
UPDATE public.self_service_onboarding_requests request_row
SET currency_id = currency_row.id
FROM public.currencies currency_row
WHERE request_row.currency_id IS NULL
  AND upper(trim(coalesce(request_row.currency, ''))) = upper(trim(coalesce(currency_row.code, '')));

CREATE INDEX IF NOT EXISTS idx_self_service_onboarding_requests_country_id
ON public.self_service_onboarding_requests(country_id);

CREATE INDEX IF NOT EXISTS idx_self_service_onboarding_requests_currency_id
ON public.self_service_onboarding_requests(currency_id);

COMMIT;
