
-- Migration: Fix Normalization Trigger
-- Description: Splits the shared normalization trigger function into table-specific functions to avoid "record has no field" errors.

BEGIN;

-- Drop the shared function and triggers
DROP TRIGGER IF EXISTS trigger_normalize_container_types ON public.container_types;
DROP TRIGGER IF EXISTS trigger_normalize_container_sizes ON public.container_sizes;
DROP FUNCTION IF EXISTS public.normalize_container_data();

-- 1. Container Types Normalizer
CREATE OR REPLACE FUNCTION public.normalize_container_type_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Normalize Name
    NEW.name := TRIM(NEW.name);
    
    -- Normalize Code
    IF NEW.code IS NOT NULL THEN
        NEW.code := UPPER(TRIM(NEW.code));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_normalize_container_types
BEFORE INSERT OR UPDATE ON public.container_types
FOR EACH ROW EXECUTE FUNCTION public.normalize_container_type_data();

-- 2. Container Sizes Normalizer
CREATE OR REPLACE FUNCTION public.normalize_container_size_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Normalize Name
    NEW.name := TRIM(NEW.name);
    
    -- Normalize ISO Code
    IF NEW.iso_code IS NOT NULL THEN
        NEW.iso_code := UPPER(TRIM(NEW.iso_code));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_normalize_container_sizes
BEFORE INSERT OR UPDATE ON public.container_sizes
FOR EACH ROW EXECUTE FUNCTION public.normalize_container_size_data();

COMMIT;
