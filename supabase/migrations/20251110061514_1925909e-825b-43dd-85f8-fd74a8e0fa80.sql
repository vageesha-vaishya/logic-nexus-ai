-- Restructure aes_hts_codes table to include UOM1 and UOM2 for AES filing

-- Add new columns for UOM1 and UOM2
ALTER TABLE public.aes_hts_codes ADD COLUMN IF NOT EXISTS uom1 VARCHAR(50);
ALTER TABLE public.aes_hts_codes ADD COLUMN IF NOT EXISTS uom2 VARCHAR(50);

-- Migrate existing data from unit_of_measure to uom1
UPDATE public.aes_hts_codes SET uom1 = unit_of_measure WHERE unit_of_measure IS NOT NULL AND uom1 IS NULL;

-- Drop the old unit_of_measure column
ALTER TABLE public.aes_hts_codes DROP COLUMN IF EXISTS unit_of_measure;

-- Add helpful comments
COMMENT ON COLUMN public.aes_hts_codes.uom1 IS 'First Unit of Measurement (Primary UOM) for AES filing - e.g., Number, Kilograms, Liters';
COMMENT ON COLUMN public.aes_hts_codes.uom2 IS 'Second Unit of Measurement (Secondary UOM) for AES filing - optional, e.g., Pairs, Dozens, Square Meters';