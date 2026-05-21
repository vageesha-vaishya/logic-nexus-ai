-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515164332; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- Fix franchises.code unique constraint: global → per-tenant (per design doc ADR-011)
-- No existing (tenant_id, code) duplicates — safe to swap.
ALTER TABLE public.franchises DROP CONSTRAINT franchises_code_key;
ALTER TABLE public.franchises ADD CONSTRAINT franchises_tenant_code_uniq UNIQUE (tenant_id, code);

-- Create a default "Primary Branch" franchise for every active tenant that
-- has business data but no franchise yet (predate enforcement constraint).
INSERT INTO public.franchises (id, tenant_id, name, code, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  t.id,
  'Primary Branch',
  'PRIMARY',
  true,
  now(),
  now()
FROM public.tenants t
WHERE t.is_active = true
  AND NOT EXISTS (SELECT 1 FROM public.franchises f WHERE f.tenant_id = t.id);

-- Verify every active tenant now has at least one franchise
DO $$
DECLARE missing INT;
BEGIN
  SELECT COUNT(*) INTO missing
  FROM   public.tenants t
  WHERE  t.is_active = true
    AND  NOT EXISTS (SELECT 1 FROM public.franchises f WHERE f.tenant_id = t.id);
  IF missing > 0 THEN
    RAISE EXCEPTION '% active tenants still have no franchise.', missing;
  END IF;
END $$;