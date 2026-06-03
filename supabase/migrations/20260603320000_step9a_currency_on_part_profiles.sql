-- Phase 7 UIM Step 9a — Q1 implementation: per-item procurement currency.
--
-- Q1 decision: per-item currency lives in the AMRO extension layer,
-- not in UIM core (currency is procurement metadata, not catalog
-- metadata).
--
-- Discovered post-design: the amro.* schema already had 39 tables
-- in production, including amro.part_profiles (catalog-level aviation
-- extension), amro.inventory_extensions (hazmat + shelf-life + trade
-- compliance), and amro.calibration_logs (per-event log). The design
-- doc's proposed item_aviation_metadata / item_life_limit_tracking /
-- item_calibration_intervals tables duplicate existing concepts.
--
-- This migration:
--   1. Drops the 3 redundant tables I created in the first attempt
--      (all empty; no production data loss).
--   2. Adds `currency` to the EXISTING amro.part_profiles.
--
-- Full reconciliation of proposed-vs-existing extension tables is
-- a follow-up audit; the design doc gets a §11 addendum noting the
-- existing amro.* surface.
--
-- Applied to prod 2026-06-03.

BEGIN;

DROP TABLE IF EXISTS amro.item_aviation_metadata CASCADE;
DROP TABLE IF EXISTS amro.item_life_limit_tracking CASCADE;
DROP TABLE IF EXISTS amro.item_calibration_intervals CASCADE;
DROP FUNCTION IF EXISTS amro.tg_touch_updated_at();

ALTER TABLE amro.part_profiles
  ADD COLUMN IF NOT EXISTS currency text;

COMMENT ON COLUMN amro.part_profiles.currency IS
  'Phase 7 Step 9 Q1: per-item procurement currency override. Falls back to franchise/tenant currency when NULL. Backfilled from amro_item_master.currency during slice 9c.';

COMMIT;
