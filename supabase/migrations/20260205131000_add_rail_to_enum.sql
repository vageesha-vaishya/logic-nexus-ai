-- Add 'rail' to transport_mode enum
DO $$
BEGIN
  -- Check if the enum type exists
  IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'transport_mode' AND n.nspname = 'public') THEN
    -- Try to add the value. 'IF NOT EXISTS' clause for ADD VALUE was added in Postgres 12.
    -- Assuming Postgres 12+
    ALTER TYPE public.transport_mode ADD VALUE IF NOT EXISTS 'rail';
  END IF;
END $$;
