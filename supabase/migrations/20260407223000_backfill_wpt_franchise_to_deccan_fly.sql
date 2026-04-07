-- Backfill work_package_templates and its task-link rows to Deccan Fly franchise
-- so franchise-scoped AMRO sessions can resolve related data correctly.

DO $$
DECLARE
  v_franchise_id uuid;
  v_tenant_id uuid;
BEGIN
  SELECT f.id, f.tenant_id
    INTO v_franchise_id, v_tenant_id
  FROM public.franchises f
  WHERE lower(f.name) = 'deccan fly'
     OR lower(f.code) IN ('deccan-fly', 'deccan_fly', 'deccanfly', 'deccan')
  ORDER BY f.is_active DESC, f.created_at ASC
  LIMIT 1;

  IF v_franchise_id IS NULL THEN
    SELECT COALESCE(
      (SELECT tenant_id FROM public.work_package_templates WHERE tenant_id IS NOT NULL LIMIT 1),
      (SELECT id FROM public.tenants ORDER BY created_at ASC LIMIT 1)
    )
    INTO v_tenant_id;

    IF v_tenant_id IS NULL THEN
      RAISE EXCEPTION 'Unable to backfill work_package_templates.franchise_id: no tenant found.';
    END IF;

    INSERT INTO public.franchises (tenant_id, name, code, address, is_active)
    VALUES (v_tenant_id, 'Deccan Fly', 'DECCAN-FLY', '{}'::jsonb, true)
    RETURNING id INTO v_franchise_id;
  END IF;

  -- Backfill template rows where franchise scope is missing.
  UPDATE public.work_package_templates t
  SET franchise_id = v_franchise_id
  WHERE t.franchise_id IS NULL
    AND (v_tenant_id IS NULL OR t.tenant_id = v_tenant_id OR t.tenant_id IS NULL);

  -- Keep linked rows in same scope for consistent franchise-scoped joins.
  UPDATE public.work_package_template_task_templates l
  SET franchise_id = v_franchise_id
  WHERE l.franchise_id IS NULL
    AND (v_tenant_id IS NULL OR l.tenant_id = v_tenant_id OR l.tenant_id IS NULL);
END $$;
