BEGIN;

ALTER TABLE public.domain_config
  ADD COLUMN IF NOT EXISTS plugin_name TEXT,
  ADD COLUMN IF NOT EXISTS json_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS encrypted_secrets TEXT,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

UPDATE public.domain_config
SET
  plugin_name = COALESCE(NULLIF(UPPER(TRIM(plugin_name)), ''), 'QUOTATION'),
  json_settings = CASE
    WHEN json_settings IS NULL OR jsonb_typeof(json_settings) <> 'object' THEN COALESCE(config, '{}'::jsonb)
    ELSE json_settings
  END
WHERE plugin_name IS NULL
   OR TRIM(plugin_name) = ''
   OR json_settings IS NULL
   OR jsonb_typeof(json_settings) <> 'object';

ALTER TABLE public.domain_config
  ALTER COLUMN plugin_name SET NOT NULL,
  ALTER COLUMN plugin_name SET DEFAULT 'QUOTATION';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'domain_config_domain_id_environment_key'
      AND conrelid = 'public.domain_config'::regclass
  ) THEN
    ALTER TABLE public.domain_config
      DROP CONSTRAINT domain_config_domain_id_environment_key;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'domain_config_domain_plugin_environment_key'
      AND conrelid = 'public.domain_config'::regclass
  ) THEN
    ALTER TABLE public.domain_config
      ADD CONSTRAINT domain_config_domain_plugin_environment_key UNIQUE (domain_id, plugin_name, environment);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_domain_config_domain_plugin
  ON public.domain_config (domain_id, plugin_name);

CREATE INDEX IF NOT EXISTS idx_domain_config_environment
  ON public.domain_config (environment);

INSERT INTO public.auth_permissions (id, category, description)
VALUES
  ('domains.config.read', 'domain_management', 'Read domain-scoped configuration'),
  ('domains.config.write', 'domain_management', 'Update domain-scoped configuration')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.auth_role_permissions (role_id, permission_id)
VALUES
  ('platform_domain_admin', 'domains.config.read'),
  ('platform_domain_admin', 'domains.config.write')
ON CONFLICT DO NOTHING;

COMMIT;
