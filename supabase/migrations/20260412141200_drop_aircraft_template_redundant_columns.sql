-- Migration: Drop redundant columns from aircraft_template table
-- Description: Remove aircraft_type, manufacturer, and manufacturer_id columns
--              that are now managed through normalized relationships.
-- Date: 2026-04-12 14:12:00

BEGIN;

-- Drop aircraft_type column (managed via aircraft_model relationship)
ALTER TABLE public.aircraft_template 
  DROP COLUMN IF EXISTS aircraft_type;

-- Drop manufacturer text column (redundant with manufacturer_id FK)
ALTER TABLE public.aircraft_template 
  DROP COLUMN IF EXISTS manufacturer;

-- Drop manufacturer_id column (no longer needed in this table)
ALTER TABLE public.aircraft_template 
  DROP COLUMN IF EXISTS manufacturer_id;

COMMIT;
