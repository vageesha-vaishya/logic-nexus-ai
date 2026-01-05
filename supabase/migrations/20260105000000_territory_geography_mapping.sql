-- Ensure territories table exists (referenced by foreign key)
CREATE TABLE IF NOT EXISTS public.territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on territories if not already enabled
ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for territories (Idempotent)
DROP POLICY IF EXISTS "Platform admins can manage all territories" ON public.territories;
CREATE POLICY "Platform admins can manage all territories"
  ON public.territories FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant territories" ON public.territories;
CREATE POLICY "Tenant admins can manage tenant territories"
  ON public.territories FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

-- Create table for linking territories to geographical entities
CREATE TABLE IF NOT EXISTS public.territory_geographies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id UUID NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  continent_id UUID REFERENCES public.continents(id) ON DELETE CASCADE,
  country_id UUID REFERENCES public.countries(id) ON DELETE CASCADE,
  state_id UUID REFERENCES public.states(id) ON DELETE CASCADE,
  city_id UUID REFERENCES public.cities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure exactly one reference is set per row
  CONSTRAINT territory_geography_type_check CHECK (
    (continent_id IS NOT NULL)::int +
    (country_id IS NOT NULL)::int +
    (state_id IS NOT NULL)::int +
    (city_id IS NOT NULL)::int = 1
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_territory_geographies_territory ON public.territory_geographies(territory_id);
CREATE INDEX IF NOT EXISTS idx_territory_geographies_continent ON public.territory_geographies(continent_id);
CREATE INDEX IF NOT EXISTS idx_territory_geographies_country ON public.territory_geographies(country_id);
CREATE INDEX IF NOT EXISTS idx_territory_geographies_state ON public.territory_geographies(state_id);

-- Enable RLS
ALTER TABLE public.territory_geographies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Platform admins can manage all
DROP POLICY IF EXISTS "Platform admins can manage all territory geographies" ON public.territory_geographies;
CREATE POLICY "Platform admins can manage all territory geographies"
  ON public.territory_geographies FOR ALL
  USING (is_platform_admin(auth.uid()));

-- Tenant admins can manage their territory geographies via the territory
DROP POLICY IF EXISTS "Tenant admins can manage their territory geographies" ON public.territory_geographies;
CREATE POLICY "Tenant admins can manage their territory geographies"
  ON public.territory_geographies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.territories t
      WHERE t.id = territory_geographies.territory_id
      AND t.tenant_id = get_user_tenant_id(auth.uid())
    )
  );

-- View access
DROP POLICY IF EXISTS "Users can view territory geographies" ON public.territory_geographies;
CREATE POLICY "Users can view territory geographies"
  ON public.territory_geographies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.territories t
      WHERE t.id = territory_geographies.territory_id
      AND (
        t.tenant_id = get_user_tenant_id(auth.uid()) OR
        is_platform_admin(auth.uid())
      )
    )
  );

-- Grants to ensure PostgREST exposes tables for anon/authenticated roles
DO $$
BEGIN
  -- Schema usage for anon/authenticated (idempotent)
  BEGIN
    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT USAGE ON SCHEMA public TO anon;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  -- Table grants for territory_geographies
  BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.territory_geographies TO authenticated;
    GRANT SELECT ON TABLE public.territory_geographies TO anon;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table public.territory_geographies not found during grants';
  WHEN others THEN
    RAISE NOTICE 'Grant failed for territory_geographies: %', SQLERRM;
  END;

  -- Table grants for territories (for completeness)
  BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.territories TO authenticated;
    GRANT SELECT ON TABLE public.territories TO anon;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table public.territories not found during grants';
  WHEN others THEN
    RAISE NOTICE 'Grant failed for territories: %', SQLERRM;
  END;
END $$;

SELECT pg_notify('pgrst', 'reload schema');
