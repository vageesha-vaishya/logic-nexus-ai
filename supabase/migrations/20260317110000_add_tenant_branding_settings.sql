BEGIN;

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS branding_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.tenants
SET branding_settings = COALESCE(branding_settings, '{}'::jsonb);

CREATE INDEX IF NOT EXISTS idx_tenants_branding_settings_gin
ON public.tenants
USING gin (branding_settings);

COMMENT ON COLUMN public.tenants.branding_settings IS 'Tenant-level branding configuration for logos, colors, fonts, white-label settings, and custom CSS.';

COMMIT;
