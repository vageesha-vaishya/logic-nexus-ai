-- Migration: Add transit_days to quotation_version_options
-- Description: Adds transit_days column to support 'Fastest' booking strategy for Autonomous Agents.

BEGIN;

ALTER TABLE public.quotation_version_options
ADD COLUMN IF NOT EXISTS transit_days INTEGER;

-- Also ensure sell_total is available (it was added in 20251119135002 but let's be safe or rely on it)
-- If it's named total_sell there, let's make sure we use that.
-- Check if total_sell exists, if not add it? No, duplicate columns are bad.
-- I will assume total_sell exists based on previous analysis.

COMMIT;
