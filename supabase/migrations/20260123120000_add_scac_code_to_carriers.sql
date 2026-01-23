-- Add scac_code column to carriers to prevent 400 errors if requested
-- This aliases the existing 'scac' column logic
ALTER TABLE public.carriers
ADD COLUMN IF NOT EXISTS scac_code TEXT;

-- Sync existing scac values to scac_code
UPDATE public.carriers
SET scac_code = scac
WHERE scac IS NOT NULL AND scac_code IS NULL;

-- Create a trigger to keep them in sync (optional, but good practice if we maintain both)
CREATE OR REPLACE FUNCTION sync_scac_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.scac IS DISTINCT FROM OLD.scac THEN
    NEW.scac_code := NEW.scac;
  ELSIF NEW.scac_code IS DISTINCT FROM OLD.scac_code THEN
    NEW.scac := NEW.scac_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_scac ON public.carriers;
CREATE TRIGGER trg_sync_scac
BEFORE INSERT OR UPDATE ON public.carriers
FOR EACH ROW
EXECUTE FUNCTION sync_scac_columns();
