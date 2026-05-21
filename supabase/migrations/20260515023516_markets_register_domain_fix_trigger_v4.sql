-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515023516; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- (1) Fix check_domain_uniqueness() trigger (null-safe + locked search_path)
CREATE OR REPLACE FUNCTION public.check_domain_uniqueness()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.code IS NOT NULL AND trim(NEW.code) <> '' THEN
    IF EXISTS (
      SELECT 1 FROM public.platform_domains
      WHERE UPPER(trim(code)) = UPPER(trim(NEW.code))
        AND id IS DISTINCT FROM NEW.id
    ) THEN
      RAISE EXCEPTION 'Domain with code "%" already exists. Please use a unique code.', NEW.code
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.platform_domains
    WHERE UPPER(trim(name)) = UPPER(trim(NEW.name))
      AND id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Domain with name "%" already exists. Please use a unique name.', NEW.name
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- (2) Register markets domain
INSERT INTO public.platform_domains
  (key, code, name, description, status, is_active, owner, swagger_endpoint)
SELECT
  'markets',
  'markets',
  'Multi-Asset Trading Platform',
  'AI-driven multi-asset trading platform (India-first; personal-use phase per design doc 2026-05-14)',
  'planned',
  true,
  'Markets Squad',
  '/api/v1/markets/openapi.json'
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_domains WHERE code = 'markets'
);

-- (3) Grant SOS Services tenant access to markets (status='trialing' per check constraint)
INSERT INTO public.tenant_domain_assignments
  (tenant_id, domain_id, is_active, subscription_status)
SELECT
  'bb451198-2877-4345-a578-d404c5720f1a'::uuid,
  (SELECT id FROM public.platform_domains WHERE code = 'markets'),
  true,
  'trialing'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tenant_domain_assignments tda
  WHERE tda.tenant_id = 'bb451198-2877-4345-a578-d404c5720f1a'::uuid
    AND tda.domain_id = (SELECT id FROM public.platform_domains WHERE code = 'markets')
);