-- Restructure aes_hts_codes table to include UOM1 and UOM2 for AES filing

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'aes_hts_codes'
  ) THEN
    ALTER TABLE public.aes_hts_codes ADD COLUMN IF NOT EXISTS uom1 VARCHAR(50);
    ALTER TABLE public.aes_hts_codes ADD COLUMN IF NOT EXISTS uom2 VARCHAR(50);

    UPDATE public.aes_hts_codes
    SET uom1 = unit_of_measure
    WHERE unit_of_measure IS NOT NULL AND uom1 IS NULL;

    ALTER TABLE public.aes_hts_codes DROP COLUMN IF EXISTS unit_of_measure;

    COMMENT ON COLUMN public.aes_hts_codes.uom1 IS 'First Unit of Measurement (Primary UOM) for AES filing - e.g., Number, Kilograms, Liters';
    COMMENT ON COLUMN public.aes_hts_codes.uom2 IS 'Second Unit of Measurement (Secondary UOM) for AES filing - optional, e.g., Pairs, Dozens, Square Meters';
  END IF;
END $$;
