-- ============================================================
-- Email Infrastructure: Phase 3A - Add Enum Values
-- Must be separate transaction from using the values
-- ============================================================

-- Add missing role types to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sales_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';