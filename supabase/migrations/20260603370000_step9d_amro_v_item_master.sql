-- Phase 7 UIM Step 9d — amro.v_item_master + public.amro_v_item_master.
--
-- The cutover view for AMRO frontend reads. Joins:
--   uim.item_master   (canonical catalog; mirrored from amro_item_master
--                      via existing dual-write trigger)
--   amro.part_profiles (AMRO extension layer; populated in slice 9b)
--
-- Column names match amro_item_master exactly so frontend callsites
-- switch by changing only the .from() table name. The extension
-- adds 13 new read-only columns (regulatory_class, ata_chapter,
-- life_limit_*, calibration_*, requires_*, procurement_currency,
-- extension_metadata).
--
-- Writes still hit public.amro_item_master directly; the dual-write
-- trigger keeps uim.item_master in sync. The view is read-only.
--
-- Applied to prod 2026-06-03.

BEGIN;

DROP VIEW IF EXISTS public.amro_v_item_master;
DROP VIEW IF EXISTS amro.v_item_master;

CREATE VIEW amro.v_item_master AS
SELECT
  im.id, im.tenant_id, im.franchise_id,
  im.part_number, im.description, im.item_type,
  im.category, im.subcategory,
  im.status, im.lifecycle_status,
  im.specification,
  im.manufacturer_name, im.manufacturer_part_number, im.oem_part_number,
  im.unit_of_measure, im.base_unit_of_measure, im.uom_conversion_factor,
  im.currency,
  im.is_active,
  im.metadata,
  im.created_by, im.updated_by,
  im.created_at, im.updated_at,
  -- AMRO extension fields (NULL when no part_profile row exists)
  pp.regulatory_class,
  pp.ata_chapter,
  pp.life_limited,
  pp.life_limit_hours,
  pp.life_limit_cycles,
  pp.life_limit_calendar_months,
  pp.calibration_required,
  pp.calibration_interval_hours,
  pp.calibration_interval_months,
  pp.certification_authorities,
  pp.requires_certification,
  pp.requires_airworthiness_release,
  pp.currency AS procurement_currency,
  pp.metadata AS extension_metadata
FROM uim.item_master im
LEFT JOIN amro.part_profiles pp ON pp.item_id = im.id;

COMMENT ON VIEW amro.v_item_master IS
  'Phase 7 Step 9d: joined view of uim.item_master + amro.part_profiles for AMRO frontend reads. Replaces direct reads from public.amro_item_master. Writes still hit amro_item_master (dual-write trigger mirrors).';

CREATE VIEW public.amro_v_item_master AS
SELECT * FROM amro.v_item_master;

COMMENT ON VIEW public.amro_v_item_master IS
  'Phase 7 Step 9d: PostgREST-exposed alias for amro.v_item_master so the supabase-js client can read it without a schemas-config change.';

GRANT SELECT ON amro.v_item_master TO authenticated;
GRANT SELECT ON public.amro_v_item_master TO authenticated;

COMMIT;
