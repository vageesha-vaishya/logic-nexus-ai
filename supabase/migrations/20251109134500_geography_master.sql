-- Geography master tables: continents, countries, states, cities

BEGIN;

-- Continents
CREATE TABLE IF NOT EXISTS public.continents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code_international text UNIQUE,
  code_national text UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Countries
CREATE TABLE IF NOT EXISTS public.countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  continent_id uuid REFERENCES public.continents(id) ON DELETE SET NULL,
  name text NOT NULL,
  code_iso2 text UNIQUE,
  code_iso3 text UNIQUE,
  code_national text,
  phone_code text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- States/Provinces
CREATE TABLE IF NOT EXISTS public.states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid REFERENCES public.countries(id) ON DELETE CASCADE,
  name text NOT NULL,
  code_iso text,
  code_national text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Cities
CREATE TABLE IF NOT EXISTS public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  state_id uuid REFERENCES public.states(id) ON DELETE SET NULL,
  name text NOT NULL,
  code_national text,
  latitude numeric,
  longitude numeric,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_countries_continent ON public.countries (continent_id);
CREATE INDEX IF NOT EXISTS idx_states_country ON public.states (country_id);
CREATE INDEX IF NOT EXISTS idx_cities_state_country ON public.cities (state_id, country_id);

-- Enable RLS
ALTER TABLE public.continents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

-- RLS Policies: read global (tenant_id NULL) or same tenant, manage same tenant
-- Global-only RLS: allow read for authenticated users; manage limited to platform admins
CREATE POLICY continents_read ON public.continents FOR SELECT USING (true);
CREATE POLICY continents_manage ON public.continents FOR ALL USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY countries_read ON public.countries FOR SELECT USING (true);
CREATE POLICY countries_manage ON public.countries FOR ALL USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY states_read ON public.states FOR SELECT USING (true);
CREATE POLICY states_manage ON public.states FOR ALL USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY cities_read ON public.cities FOR SELECT USING (true);
CREATE POLICY cities_manage ON public.cities FOR ALL USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

COMMIT;