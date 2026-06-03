-- Phase 7 UIM Step 9b — backfill amro.part_profiles from amro_item_master.
--
-- Revised topology (audit 2026-06-03):
--   uim.item_master (75 rows)        ←→ amro_item_master (75 rows, same ids)
--   amro.part_profiles                FK: item_id → uim.item_master.id
--   uim_mro_item_profiles (900 rows) → public.uim_catalog_items
--                                       (DIFFERENT catalog, not the AMRO set)
--
-- Q6 revised: uim_mro_item_profiles stays where it is (serves the generic
-- catalog extension); amro.part_profiles backfills DIRECTLY from
-- amro_item_master. No inter-table fold.
--
-- Applied to prod 2026-06-03; smoke verified:
--   75 rows backfilled, 15 distinct tenants
--   60 consumables + 15 tools (regulatory_class derived from item_type)
--   All 75 rows carry ata_chapter + currency.

BEGIN;

ALTER TABLE amro.part_profiles
  ADD COLUMN IF NOT EXISTS franchise_id uuid,
  ADD COLUMN IF NOT EXISTS source_specification jsonb,
  ADD COLUMN IF NOT EXISTS source_metadata jsonb,
  ADD COLUMN IF NOT EXISTS source_item_type text,
  ADD COLUMN IF NOT EXISTS source_subcategory text;

COMMENT ON COLUMN amro.part_profiles.source_specification IS
  'Step 9b: full amro_item_master.specification JSONB stash. Used for future enrichment passes that lift additional fields out as first-class columns.';

CREATE INDEX IF NOT EXISTS idx_amro_part_profiles_tenant_franchise
  ON amro.part_profiles (tenant_id, franchise_id)
  WHERE franchise_id IS NOT NULL;

INSERT INTO amro.part_profiles (
  tenant_id, item_id, franchise_id,
  ata_chapter, regulatory_class, currency,
  source_item_type, source_subcategory,
  source_specification, source_metadata, metadata,
  life_limited, requires_certification, requires_airworthiness_release,
  calibration_required
)
SELECT
  am.tenant_id, am.id, am.franchise_id,
  am.specification->>'ata_chapter',
  CASE lower(coalesce(am.item_type, ''))
    WHEN 'rotable'    THEN 'rotable'
    WHEN 'consumable' THEN 'consumable'
    WHEN 'expendable' THEN 'expendable'
    WHEN 'tooling'    THEN 'tooling'
    WHEN 'tool'       THEN 'tooling'
    ELSE 'consumable'
  END,
  am.currency,
  am.item_type,
  am.subcategory,
  am.specification,
  am.metadata,
  coalesce(am.specification, '{}'::jsonb) || coalesce(am.metadata, '{}'::jsonb),
  false,  -- life_limited default false
  true,   -- requires_certification — AMRO default
  CASE lower(coalesce(am.item_type, '')) WHEN 'rotable' THEN true ELSE false END,
  false   -- calibration_required default; real schedule arrives via calibration_logs
FROM public.amro_item_master am
WHERE EXISTS (SELECT 1 FROM uim.item_master im WHERE im.id = am.id)
ON CONFLICT (tenant_id, item_id) DO UPDATE
SET
  franchise_id           = EXCLUDED.franchise_id,
  ata_chapter            = EXCLUDED.ata_chapter,
  regulatory_class       = EXCLUDED.regulatory_class,
  currency               = EXCLUDED.currency,
  source_item_type       = EXCLUDED.source_item_type,
  source_subcategory     = EXCLUDED.source_subcategory,
  source_specification   = EXCLUDED.source_specification,
  source_metadata        = EXCLUDED.source_metadata,
  metadata               = EXCLUDED.metadata,
  requires_airworthiness_release = EXCLUDED.requires_airworthiness_release,
  updated_at             = now();

COMMIT;
