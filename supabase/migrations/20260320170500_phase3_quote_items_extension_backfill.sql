-- DB-VERIFICATION: quote-items-extension-migration-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-signoff

BEGIN;

DO $$
DECLARE
  v_missing_before integer := 0;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_missing_after integer := 0;
BEGIN
  IF to_regclass('public.quote_items_core') IS NULL OR to_regclass('logistics.quote_items_extension') IS NULL THEN
    RAISE NOTICE 'Skipping Phase 3.3 backfill: required tables are missing';
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO v_missing_before
  FROM public.quote_items_core c
  LEFT JOIN logistics.quote_items_extension e
    ON e.quote_item_id = c.id
  WHERE e.quote_item_id IS NULL;

  WITH inserted_rows AS (
    INSERT INTO logistics.quote_items_extension (
      quote_item_id,
      tenant_id,
      franchise_id,
      package_category_id,
      package_size_id,
      cargo_type_id,
      service_type_id,
      weight_kg,
      volume_cbm,
      special_instructions,
      attributes,
      type,
      container_type_id,
      container_size_id
    )
    SELECT
      c.id,
      c.tenant_id,
      c.franchise_id,
      qi.package_category_id,
      qi.package_size_id,
      qi.cargo_type_id,
      qi.service_type_id,
      qi.weight_kg,
      qi.volume_cbm,
      qi.special_instructions,
      COALESCE(qi.attributes, '{}'::jsonb)
        || CASE
          WHEN qi.hazmat_class IS NULL THEN '{}'::jsonb
          ELSE jsonb_build_object('hazmat_class', qi.hazmat_class)
        END
        || CASE
          WHEN qi.un_number IS NULL THEN '{}'::jsonb
          ELSE jsonb_build_object('un_number', qi.un_number)
        END,
      COALESCE(qi.type, 'loose'),
      qi.container_type_id,
      qi.container_size_id
    FROM public.quote_items_core c
    LEFT JOIN logistics.quote_items_extension e
      ON e.quote_item_id = c.id
    LEFT JOIN public.quote_items qi
      ON qi.id = c.id
    WHERE e.quote_item_id IS NULL
    ON CONFLICT (quote_item_id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted_rows;

  UPDATE logistics.quote_items_extension e
  SET
    tenant_id = COALESCE(e.tenant_id, c.tenant_id),
    franchise_id = COALESCE(e.franchise_id, c.franchise_id),
    attributes = COALESCE(e.attributes, '{}'::jsonb)
  FROM public.quote_items_core c
  WHERE c.id = e.quote_item_id
    AND (e.tenant_id IS NULL OR e.franchise_id IS NULL OR e.attributes IS NULL);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  SELECT COUNT(*)
  INTO v_missing_after
  FROM public.quote_items_core c
  LEFT JOIN logistics.quote_items_extension e
    ON e.quote_item_id = c.id
  WHERE e.quote_item_id IS NULL;

  RAISE NOTICE
    'Phase 3.3 quote_items backfill complete: missing_before=%, inserted=%, normalized=%, missing_after=%',
    v_missing_before, v_inserted, v_updated, v_missing_after;

  IF v_missing_after > 0 THEN
    RAISE EXCEPTION 'Phase 3.3 quote_items migration invariant failed: % core rows still missing extension rows', v_missing_after;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.quote_items_view AS
SELECT *
FROM public.quote_items;

GRANT SELECT ON public.quote_items_view TO anon, authenticated, service_role;

COMMIT;
