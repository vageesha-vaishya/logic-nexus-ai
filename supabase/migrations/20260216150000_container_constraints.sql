-- Migration: Container Type/Size Constraints and Normalization
-- Description: Adds unique indexes and foreign key constraints to container_types and container_sizes to prevent duplicates.
-- Implements "Database layer" of the duplicate prevention strategy.

BEGIN;

-- 1. Container Types Constraints
-- Ensure name is unique to prevent duplicate types like "Dry Standard" vs "Dry"
ALTER TABLE public.container_types
ADD CONSTRAINT container_types_name_key UNIQUE (name);

-- 2. Container Sizes Constraints
-- Ensure size names are unique within a type (e.g., can't have two "20ft" for "Dry Standard")
ALTER TABLE public.container_sizes
ADD CONSTRAINT container_sizes_type_id_name_key UNIQUE (type_id, name);

-- Ensure ISO codes are unique where provided (global standard)
-- Note: Using partial index for non-null ISO codes
CREATE UNIQUE INDEX IF NOT EXISTS container_sizes_iso_code_key 
ON public.container_sizes (iso_code) 
WHERE iso_code IS NOT NULL;

-- 3. Update Foreign Key to ON DELETE CASCADE (as requested)
-- First drop existing constraint if possible (name might vary, so we try standard names)
-- We'll use a DO block to find and drop the constraint safely

DO $$
DECLARE
    fk_name text;
BEGIN
    SELECT conname INTO fk_name
    FROM pg_constraint
    WHERE conrelid = 'public.container_sizes'::regclass
    AND confrelid = 'public.container_types'::regclass
    AND contype = 'f';

    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.container_sizes DROP CONSTRAINT ' || fk_name;
    END IF;
END $$;

-- Re-add the constraint with ON DELETE CASCADE
ALTER TABLE public.container_sizes
ADD CONSTRAINT container_sizes_type_id_fkey
FOREIGN KEY (type_id)
REFERENCES public.container_types (id)
ON DELETE CASCADE;

-- 4. Database Triggers for Duplicate Detection (audit/logging)
-- Create a function to log attempts to insert duplicates (if they were to bypass constraints, though constraints stop them)
-- Or more usefully, sanitize input before insert.
-- Here we'll just rely on the constraints for strict enforcement, but we can add a trigger to clean up names (trim/upper)

CREATE OR REPLACE FUNCTION public.normalize_container_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Normalize Name
    NEW.name := TRIM(NEW.name);
    
    -- Normalize Code if present (container_types)
    IF TG_TABLE_NAME = 'container_types' AND NEW.code IS NOT NULL THEN
        NEW.code := UPPER(TRIM(NEW.code));
    END IF;

    -- Normalize ISO Code if present (container_sizes)
    IF TG_TABLE_NAME = 'container_sizes' AND NEW.iso_code IS NOT NULL THEN
        NEW.iso_code := UPPER(TRIM(NEW.iso_code));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_normalize_container_types ON public.container_types;
CREATE TRIGGER trigger_normalize_container_types
BEFORE INSERT OR UPDATE ON public.container_types
FOR EACH ROW EXECUTE FUNCTION public.normalize_container_data();

DROP TRIGGER IF EXISTS trigger_normalize_container_sizes ON public.container_sizes;
CREATE TRIGGER trigger_normalize_container_sizes
BEFORE INSERT OR UPDATE ON public.container_sizes
FOR EACH ROW EXECUTE FUNCTION public.normalize_container_data();

COMMIT;
