-- Add warranty_json cache column on aircraft for Create Aircraft warranty details.
ALTER TABLE IF EXISTS public.aircraft
ADD COLUMN IF NOT EXISTS warranty_json jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aircraft'
      AND column_name = 'is_under_warranty'
  ) THEN
    UPDATE public.aircraft
    SET warranty_json = jsonb_build_object(
      'is_under_warranty', COALESCE(is_under_warranty, false),
      'warranty_start_date', COALESCE(to_char(warranty_start_date, 'YYYY-MM-DD'), ''),
      'warranty_end_date', COALESCE(to_char(warranty_end_date, 'YYYY-MM-DD'), '')
    )
    WHERE warranty_json IS NULL
      OR warranty_json = '{}'::jsonb;
  END IF;
END $$;
