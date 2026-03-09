-- Enhanced NYC→DED Multi-Modal Routing Schema
-- Extends existing tables with comprehensive multi-leg routing capabilities

-- Enhanced Leg Connections with Transfer Metadata
ALTER TABLE public.rate_option_legs 
ADD COLUMN IF NOT EXISTS cost_breakdown jsonb DEFAULT '{"base_freight": 0, "fuel_surcharge": 0, "security_fee": 0, "port_charges": 0, "handling_fee": 0}'::jsonb,
ADD COLUMN IF NOT EXISTS equipment_requirements jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS capacity_available boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS reliability_score numeric(3,2) DEFAULT 0.95,
ADD COLUMN IF NOT EXISTS carrier_alliance_members jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS service_level text DEFAULT 'standard' CHECK (service_level IN ('express', 'standard', 'economy')),
ADD COLUMN IF NOT EXISTS real_time_pricing boolean DEFAULT false;

-- Transfer Points Table for Inter-Modal Connections
CREATE TABLE IF NOT EXISTS public.transfer_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  location_type text NOT NULL CHECK (location_type IN ('airport', 'seaport', 'rail_terminal', 'truck_terminal', 'intermodal_yard')),
  country_code text NOT NULL,
  latitude numeric(9,6),
  longitude numeric(9,6),
  timezone text DEFAULT 'UTC',
  operating_hours jsonb DEFAULT '{}'::jsonb,
  facility_capabilities jsonb DEFAULT '[]'::jsonb,
  security_level text DEFAULT 'standard' CHECK (security_level IN ('standard', 'enhanced', 'maximum')),
  customs_clearance_available boolean DEFAULT false,
  average_dwell_time_hours integer DEFAULT 24,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  CONSTRAINT transfer_points_unique_code UNIQUE (tenant_id, code)
);

-- Leg Connections with Transfer Metadata
CREATE TABLE IF NOT EXISTS public.leg_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  rate_option_id uuid NOT NULL REFERENCES public.rate_options(id) ON DELETE CASCADE,
  from_leg_id uuid NOT NULL REFERENCES public.rate_option_legs(id) ON DELETE CASCADE,
  to_leg_id uuid NOT NULL REFERENCES public.rate_option_legs(id) ON DELETE CASCADE,
  transfer_point_id uuid REFERENCES public.transfer_points(id),
  min_connection_hours integer DEFAULT 4,
  max_connection_hours integer DEFAULT 48,
  equipment_transfer_required boolean DEFAULT false,
  customs_clearance_required boolean DEFAULT false,
  transfer_cost numeric(14,2) DEFAULT 0,
  transfer_time_hours integer DEFAULT 6,
  carrier_handover_required boolean DEFAULT false,
  insurance_coverage_transition jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  CONSTRAINT leg_connections_unique_transfer UNIQUE (rate_option_id, from_leg_id, to_leg_id)
);

-- NYC→DED Routing Matrix (Pre-calculated optimal routes)
CREATE TABLE IF NOT EXISTS public.nyc_ded_routing_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  origin_code text NOT NULL CHECK (origin_code IN ('JFK', 'EWR', 'LGA', 'PANYNJ', 'NYCTRUCK')),
  destination_code text NOT NULL CHECK (destination_code = 'DED'),
  transport_mode_sequence text[] NOT NULL,
  total_transit_days integer NOT NULL,
  total_cost numeric(14,2) NOT NULL,
  viability_score numeric(3,2) DEFAULT 1.0,
  carrier_alliances text[] DEFAULT '{}'::text[],
  transfer_points text[] DEFAULT '{}'::text[],
  equipment_compatibility jsonb DEFAULT '[]'::jsonb,
  commodity_restrictions jsonb DEFAULT '[]'::jsonb,
  seasonal_availability jsonb DEFAULT '{}'::jsonb,
  reliability_score numeric(3,2) DEFAULT 0.95,
  last_updated timestamptz DEFAULT NOW(),
  created_at timestamptz DEFAULT NOW(),
  CONSTRAINT nyc_ded_matrix_unique_route UNIQUE (tenant_id, origin_code, transport_mode_sequence)
);

-- Enhanced Commodity Classification System
CREATE TABLE IF NOT EXISTS public.commodity_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  hs_code text NOT NULL,
  description text NOT NULL,
  commodity_type text NOT NULL CHECK (commodity_type IN ('general', 'hazardous', 'perishable', 'pharmaceutical', 'fragile', 'oversized')),
  imdg_class text,
  un_number text,
  packing_group text CHECK (packing_group IN ('I', 'II', 'III')),
  temperature_range jsonb DEFAULT '{"min_c": -20, "max_c": 25}'::jsonb,
  flash_point_c integer,
  marine_pollutant boolean DEFAULT false,
  special_handling_requirements jsonb DEFAULT '[]'::jsonb,
  routing_restrictions jsonb DEFAULT '[]'::jsonb,
  insurance_multiplier numeric(4,2) DEFAULT 1.0,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  CONSTRAINT commodity_classifications_unique_hs UNIQUE (tenant_id, hs_code)
);

-- Enhanced Container Specifications
CREATE TABLE IF NOT EXISTS public.container_specifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  iso_code text NOT NULL,
  container_type text NOT NULL CHECK (container_type IN ('standard', 'open_top', 'flat_rack', 'reefer', 'platform')),
  container_size text NOT NULL CHECK (container_size IN ('20''', '40''', '40''HC', '45''')),
  tare_weight_kg numeric(8,2) NOT NULL,
  max_payload_kg numeric(8,2) NOT NULL,
  internal_length_mm integer,
  internal_width_mm integer,
  internal_height_mm integer,
  door_opening_width_mm integer,
  door_opening_height_mm integer,
  max_gross_weight_kg numeric(8,2),
  reefer_capabilities jsonb DEFAULT '{}'::jsonb,
  special_features jsonb DEFAULT '[]'::jsonb,
  compatibility_matrix jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  CONSTRAINT container_specs_unique_iso UNIQUE (tenant_id, iso_code)
);

-- Dynamic Surcharge Configuration
CREATE TABLE IF NOT EXISTS public.dynamic_surcharges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  surcharge_type text NOT NULL CHECK (surcharge_type IN ('fuel', 'currency', 'security', 'peak_season', 'emergency')),
  applicable_to text[] DEFAULT '{}'::text[] CHECK (applicable_to <@ ARRAY['air', 'ocean', 'road', 'rail']),
  calculation_method text NOT NULL CHECK (calculation_method IN ('percentage', 'fixed', 'formula')),
  base_value numeric(10,4),
  min_value numeric(10,2),
  max_value numeric(10,2),
  currency text DEFAULT 'USD',
  validity_period daterange NOT NULL,
  trigger_conditions jsonb DEFAULT '{}'::jsonb,
  external_data_source jsonb DEFAULT '{}'::jsonb,
  last_updated timestamptz DEFAULT NOW(),
  created_at timestamptz DEFAULT NOW()
);

-- RLS Policies for Enhanced Tables
ALTER TABLE public.transfer_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leg_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nyc_ded_routing_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commodity_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.container_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_surcharges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view transfer_points for their tenant" ON public.transfer_points';
  EXECUTE 'CREATE POLICY "Users can view transfer_points for their tenant" ON public.transfer_points FOR ALL USING (tenant_id = auth.uid()::text::uuid)';

  EXECUTE 'DROP POLICY IF EXISTS "Tenants can only access their leg connections" ON public.leg_connections';
  EXECUTE 'CREATE POLICY "Tenants can only access their leg connections" ON public.leg_connections FOR ALL USING (tenant_id = auth.uid()::text::uuid)';

  EXECUTE 'DROP POLICY IF EXISTS "Tenants can only access their routing matrix" ON public.nyc_ded_routing_matrix';
  EXECUTE 'CREATE POLICY "Tenants can only access their routing matrix" ON public.nyc_ded_routing_matrix FOR ALL USING (tenant_id = auth.uid()::text::uuid)';

  EXECUTE 'DROP POLICY IF EXISTS "Tenants can only access their commodity classifications" ON public.commodity_classifications';
  EXECUTE 'CREATE POLICY "Tenants can only access their commodity classifications" ON public.commodity_classifications FOR ALL USING (tenant_id = auth.uid()::text::uuid)';

  EXECUTE 'DROP POLICY IF EXISTS "Tenants can only access their container specs" ON public.container_specifications';
  EXECUTE 'CREATE POLICY "Tenants can only access their container specs" ON public.container_specifications FOR ALL USING (tenant_id = auth.uid()::text::uuid)';

  EXECUTE 'DROP POLICY IF EXISTS "Tenants can only access their dynamic surcharges" ON public.dynamic_surcharges';
  EXECUTE 'CREATE POLICY "Tenants can only access their dynamic surcharges" ON public.dynamic_surcharges FOR ALL USING (tenant_id = auth.uid()::text::uuid)';
END $$;

-- Indexes for Performance Optimization
CREATE INDEX IF NOT EXISTS idx_transfer_points_geo ON public.transfer_points USING gist (point(longitude, latitude));
CREATE INDEX IF NOT EXISTS idx_nyc_ded_matrix_origin ON public.nyc_ded_routing_matrix (origin_code, tenant_id);
CREATE INDEX IF NOT EXISTS idx_commodity_hs_type ON public.commodity_classifications (hs_code, commodity_type, tenant_id);
CREATE INDEX IF NOT EXISTS idx_container_type_size ON public.container_specifications (container_type, container_size, tenant_id);
CREATE INDEX IF NOT EXISTS idx_surcharges_validity ON public.dynamic_surcharges (validity_period, tenant_id);

-- Insert NYC Transfer Points
INSERT INTO public.transfer_points (tenant_id, code, name, location_type, country_code, latitude, longitude, facility_capabilities) VALUES
('00000000-0000-0000-0000-000000000000', 'JFK', 'John F. Kennedy International Airport', 'airport', 'US', 40.6413, -73.7781, '["air_cargo", "cold_storage", "hazardous_materials", "oversized_cargo"]'),
('00000000-0000-0000-0000-000000000000', 'EWR', 'Newark Liberty International Airport', 'airport', 'US', 40.6895, -74.1745, '["air_cargo", "cold_storage", "express_handling"]'),
('00000000-0000-0000-0000-000000000000', 'LGA', 'LaGuardia Airport', 'airport', 'US', 40.7769, -73.8740, '["air_cargo", "general_cargo"]'),
('00000000-0000-0000-0000-000000000000', 'PANYNJ', 'Port Authority of NY/NJ', 'seaport', 'US', 40.6981, -74.0306, '["container_handling", "breakbulk", "ro_ro", "hazardous_materials"]'),
('00000000-0000-0000-0000-000000000000', 'NYCTRUCK', 'New York City Truck Terminal', 'truck_terminal', 'US', 40.7505, -73.9934, '["cross_docking", "lcl_consolidation", "distribution"]'),
('00000000-0000-0000-0000-000000000000', 'DED', 'Dehra Dun Airport', 'airport', 'IN', 30.3165, 78.0322, '["air_cargo", "general_cargo", "customs_clearance"]')
ON CONFLICT ON CONSTRAINT transfer_points_unique_code DO NOTHING;

-- Insert Sample NYC→DED Routing Matrix
INSERT INTO public.nyc_ded_routing_matrix (tenant_id, origin_code, destination_code, transport_mode_sequence, total_transit_days, total_cost, viability_score, carrier_alliances, transfer_points) VALUES
('00000000-0000-0000-0000-000000000000', 'JFK', 'DED', '{"air"}', 2, 8500.00, 0.95, '{"Star Alliance", "SkyTeam Cargo"}', '{}'),
('00000000-0000-0000-0000-000000000000', 'JFK', 'DED', '{"air", "road"}', 4, 6200.00, 0.88, '{"SkyTeam Cargo"}', '{"DEL"}'),
('00000000-0000-0000-0000-000000000000', 'EWR', 'DED', '{"air"}', 2, 8200.00, 0.93, '{"Star Alliance"}', '{}'),
('00000000-0000-0000-0000-000000000000', 'PANYNJ', 'DED', '{"ocean", "rail", "road"}', 28, 4200.00, 0.82, '{"Ocean Alliance", "THE Alliance"}', '{"MUMBAI", "DELHI"}'),
('00000000-0000-0000-0000-000000000000', 'PANYNJ', 'DED', '{"ocean", "road"}', 32, 3800.00, 0.78, '{"Ocean Alliance"}', '{"MUMBAI"}')
ON CONFLICT ON CONSTRAINT nyc_ded_matrix_unique_route DO NOTHING;
