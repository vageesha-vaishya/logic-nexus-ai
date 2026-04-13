-- Migration: Add franchise_id column to aircraft_template_counters table
-- Description: Add franchise_id FK to enable franchise-scoped template counters
-- Date: 2026-04-12 14:15:00

BEGIN;

-- Add franchise_id column with foreign key constraint
ALTER TABLE public.aircraft_template_counters
  ADD COLUMN IF NOT EXISTS franchise_id uuid;

-- Add foreign key constraint
ALTER TABLE public.aircraft_template_counters
  ADD CONSTRAINT aircraft_template_counters_franchise_id_fkey
  FOREIGN KEY (franchise_id)
  REFERENCES public.franchises(id)
  ON DELETE SET NULL;

-- Create index on franchise_id for better query performance
CREATE INDEX IF NOT EXISTS idx_aircraft_template_counters_franchise_id
  ON public.aircraft_template_counters(franchise_id);

COMMIT;
