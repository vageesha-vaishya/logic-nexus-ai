BEGIN;

-- Allow viewing global carriers (tenant_id IS NULL)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'carriers' AND policyname = 'Users can view global carriers'
  ) THEN
    CREATE POLICY "Users can view global carriers"
    ON public.carriers
    FOR SELECT
    USING (tenant_id IS NULL);
  END IF;
END $$;

-- Allow viewing global carrier/service type mappings (tenant_id IS NULL)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'carrier_service_types' AND policyname = 'Users can view global carrier type mappings'
  ) THEN
    CREATE POLICY "Users can view global carrier type mappings"
    ON public.carrier_service_types
    FOR SELECT
    USING (tenant_id IS NULL);
  END IF;
END $$;

COMMIT;