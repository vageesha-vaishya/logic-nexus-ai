-- Ensure work_package_templates.franchise_id exists and repair Deccan/Deccan Fly scope data.
-- This migration is schema-safe across environments with optional "code" columns.

ALTER TABLE public.work_package_templates
  ADD COLUMN IF NOT EXISTS franchise_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'work_package_templates_franchise_id_fkey'
      AND conrelid = 'public.work_package_templates'::regclass
  ) THEN
    ALTER TABLE public.work_package_templates
      ADD CONSTRAINT work_package_templates_franchise_id_fkey
      FOREIGN KEY (franchise_id)
      REFERENCES public.franchises(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_work_package_templates_franchise_id
  ON public.work_package_templates(franchise_id);

DO $$
DECLARE
  v_tenant_id uuid;
  v_franchise_id uuid;
  v_has_tenant_code boolean := false;
  v_has_franchise_code boolean := false;
  v_has_rel_franchise_column boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'code'
  ) INTO v_has_tenant_code;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'franchises'
      AND column_name = 'code'
  ) INTO v_has_franchise_code;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_package_template_task_templates'
      AND column_name = 'franchise_id'
  ) INTO v_has_rel_franchise_column;

  -- Resolve Deccan tenant (prefer known id, fallback by name/code).
  IF v_has_tenant_code THEN
    SELECT t.id
      INTO v_tenant_id
    FROM public.tenants t
    WHERE t.id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
       OR lower(t.name) LIKE 'deccan%'
       OR lower(coalesce(t.code, '')) LIKE 'deccan%'
    ORDER BY (t.id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid) DESC, t.created_at ASC
    LIMIT 1;
  ELSE
    SELECT t.id
      INTO v_tenant_id
    FROM public.tenants t
    WHERE t.id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid
       OR lower(t.name) LIKE 'deccan%'
    ORDER BY (t.id = 'e42ec6fd-6b88-4721-befe-4443d9743120'::uuid) DESC, t.created_at ASC
    LIMIT 1;
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Deccan tenant not found; cannot backfill work_package_templates.franchise_id';
  END IF;

  -- Resolve/create Deccan Fly franchise.
  SELECT f.id
    INTO v_franchise_id
  FROM public.franchises f
  WHERE f.tenant_id = v_tenant_id
    AND (
      lower(f.name) = 'deccan fly'
      OR (
        v_has_franchise_code
        AND lower(coalesce(f.code, '')) IN ('deccan-fly', 'deccan_fly', 'deccanfly', 'deccan')
      )
    )
  ORDER BY f.is_active DESC, f.created_at ASC
  LIMIT 1;

  IF v_franchise_id IS NULL THEN
    IF v_has_franchise_code THEN
      INSERT INTO public.franchises (tenant_id, name, code, address, is_active)
      VALUES (v_tenant_id, 'Deccan Fly', 'DECCAN-FLY', '{}'::jsonb, true)
      RETURNING id INTO v_franchise_id;
    ELSE
      INSERT INTO public.franchises (tenant_id, name, address, is_active)
      VALUES (v_tenant_id, 'Deccan Fly', '{}'::jsonb, true)
      RETURNING id INTO v_franchise_id;
    END IF;
  END IF;

  -- Backfill WPT rows in Deccan tenant where scope is missing.
  UPDATE public.work_package_templates w
  SET franchise_id = v_franchise_id
  WHERE w.tenant_id = v_tenant_id
    AND w.franchise_id IS NULL;

  -- Keep relation table in same scope where franchise_id column exists.
  IF v_has_rel_franchise_column THEN
    UPDATE public.work_package_template_task_templates r
    SET franchise_id = v_franchise_id
    WHERE r.tenant_id = v_tenant_id
      AND r.franchise_id IS NULL;
  END IF;
END $$;
