-- Migration to remove obsolete HTS tables
-- Date: 2026-02-06
-- Description: Drops master_hts and related tables identified as obsolete in HTS_MIGRATION_ANALYSIS.md.

BEGIN;

-- 1. Drop dependent tables first
DROP TABLE IF EXISTS public.master_hts_history CASCADE;
DROP TABLE IF EXISTS public.discrepancy_logs CASCADE;
DROP TABLE IF EXISTS public.hts_verification_reports CASCADE;

-- 2. Drop the main table
DROP TABLE IF EXISTS public.master_hts CASCADE;

-- 3. Cleanup specific feature flags
DELETE FROM public.app_feature_flags 
WHERE flag_key IN ('hts_auto_retire', 'hts_queue_new_codes');

-- 4. Cleanup triggers if any remain (usually handled by CASCADE drop of table)
DROP FUNCTION IF EXISTS public.handle_master_hts_history();

COMMIT;
