-- Phase 7 UIM Step 9 Q2 — hoist manufacturer fields to uim_catalog_items.
--
-- Q2 decision: 3 manufacturer fields (manufacturer_name,
-- manufacturer_part_number, oem_part_number) become first-class
-- columns on uim.catalog_items instead of staying in attributes JSONB.
--
-- Why: cross-industry value (auto parts, electronics, aviation OEM
-- lookup), 3 nullable text cols are cheap, indexable for OEM-search
-- use cases, AMRO backfill (slice 9c) becomes a clean column copy
-- instead of JSONB extraction.
--
-- Applied to prod 2026-06-03.

BEGIN;

ALTER TABLE public.uim_catalog_items
  ADD COLUMN IF NOT EXISTS manufacturer_name text,
  ADD COLUMN IF NOT EXISTS manufacturer_part_number text,
  ADD COLUMN IF NOT EXISTS oem_part_number text;

COMMENT ON COLUMN public.uim_catalog_items.manufacturer_name IS
  'Step 9 Q2: hoisted from attributes JSONB. Manufacturer / brand display name.';
COMMENT ON COLUMN public.uim_catalog_items.manufacturer_part_number IS
  'Step 9 Q2: hoisted. Vendor part number (their SKU).';
COMMENT ON COLUMN public.uim_catalog_items.oem_part_number IS
  'Step 9 Q2: hoisted. Original equipment manufacturer part number; used for cross-reference + supersession.';

CREATE INDEX IF NOT EXISTS idx_uim_catalog_items_mfg_pn
  ON public.uim_catalog_items (tenant_id, manufacturer_part_number)
  WHERE manufacturer_part_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_uim_catalog_items_oem_pn
  ON public.uim_catalog_items (tenant_id, oem_part_number)
  WHERE oem_part_number IS NOT NULL;

COMMIT;
