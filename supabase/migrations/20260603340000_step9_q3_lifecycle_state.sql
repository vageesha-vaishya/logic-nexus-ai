-- Phase 7 UIM Step 9 Q3 — lifecycle_state on uim.catalog_items
-- + amro.map_lifecycle_to_uim() mapping function.
--
-- Decision basis (real prod audit 2026-06-03):
--   AMRO `status`: only 'active' across 75 rows (under-utilized)
--   AMRO `lifecycle_status`: 4 values (serviceable, inspection_due,
--     quarantined, ready_for_install) — actually per-item
--     airworthiness, not catalog state
--   AMRO `is_active`: redundant with status
--
-- Mapping rule:
--   UIM lifecycle_state = canonical catalog lifecycle
--     ('active' | 'draft' | 'retired' | 'archived')
--   AMRO `status` → UIM lifecycle_state 1:1
--   AMRO `is_active=false` → retired
--   AMRO `lifecycle_status` → INTENTIONALLY IGNORED at catalog level
--     (it's per-physical-item airworthiness; lives on AMRO extension)
--
-- Applied to prod 2026-06-03.

BEGIN;

ALTER TABLE public.uim_catalog_items
  ADD COLUMN IF NOT EXISTS lifecycle_state text NOT NULL DEFAULT 'active'
  CHECK (lifecycle_state IN ('active','draft','retired','archived'));

COMMENT ON COLUMN public.uim_catalog_items.lifecycle_state IS
  'Step 9 Q3: canonical catalog lifecycle. Cross-industry. AMRO is_active=true → active. AMRO lifecycle_status (serviceable/quarantined/etc) is per-physical-item airworthiness; lives on AMRO extension, NOT here.';

CREATE INDEX IF NOT EXISTS idx_uim_catalog_items_lifecycle
  ON public.uim_catalog_items (tenant_id, lifecycle_state)
  WHERE lifecycle_state <> 'active';

CREATE OR REPLACE FUNCTION amro.map_lifecycle_to_uim(
  p_status text,
  p_lifecycle_status text,
  p_is_active boolean
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_is_active = false THEN RETURN 'retired'; END IF;
  IF p_status = 'draft' THEN RETURN 'draft'; END IF;
  IF p_status = 'archived' THEN RETURN 'archived'; END IF;
  IF p_status = 'retired' THEN RETURN 'retired'; END IF;
  RETURN 'active';
END;
$$;

COMMENT ON FUNCTION amro.map_lifecycle_to_uim IS
  'Step 9 Q3: maps AMRO 3-column (status, lifecycle_status, is_active) → UIM single lifecycle_state. Used by slice 9c backfill. lifecycle_status is intentionally ignored — it is per-item airworthiness, not catalog state.';

COMMIT;
