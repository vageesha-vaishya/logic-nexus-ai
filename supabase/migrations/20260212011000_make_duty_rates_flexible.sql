
BEGIN;

-- Make aes_hts_id nullable to support direct HS code usage without FK dependency
ALTER TABLE public.duty_rates ALTER COLUMN aes_hts_id DROP NOT NULL;

COMMIT;
