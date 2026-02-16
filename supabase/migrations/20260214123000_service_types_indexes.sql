BEGIN;

CREATE INDEX IF NOT EXISTS idx_service_types_active
ON public.service_types (is_active);

CREATE INDEX IF NOT EXISTS idx_service_types_code
ON public.service_types (code);

COMMIT;
