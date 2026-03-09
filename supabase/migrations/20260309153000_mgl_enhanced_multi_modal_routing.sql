-- Enhanced MGL Multi-Modal Routing Schema for NYC→Dehra Dun Quotations
-- Migration for QUO-260309-00001 enhancements

-- 1. Enhanced rate_option_legs table with carrier alliance and equipment compatibility
ALTER TABLE public.rate_option_legs 
ADD COLUMN IF NOT EXISTS carrier_alliance_code TEXT,
ADD COLUMN IF NOT EXISTS "mode" TEXT,
ADD COLUMN IF NOT EXISTS equipment_restrictions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS transit_time_buffer_hours INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS service_level TEXT DEFAULT 'standard' CHECK (service_level IN ('express', 'standard', 'economy')),
ADD COLUMN IF NOT EXISTS capacity_available BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cut_off_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS real_time_availability BOOLEAN DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rate_option_legs'
      AND column_name = 'transport_mode'
  ) THEN
    UPDATE public.rate_option_legs
    SET "mode" = COALESCE("mode", transport_mode)
    WHERE "mode" IS NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.rate_option_legs.carrier_alliance_code IS 'Carrier alliance/interline partnership code';
COMMENT ON COLUMN public.rate_option_legs.equipment_restrictions IS 'JSON array of allowed equipment types for this leg';
COMMENT ON COLUMN public.rate_option_legs.transit_time_buffer_hours IS 'Additional buffer time for port/airport congestion';
COMMENT ON COLUMN public.rate_option_legs.service_level IS 'Service level (express, standard, economy)';
COMMENT ON COLUMN public.rate_option_legs.capacity_available IS 'Real-time capacity availability flag';

-- 2. Create carrier alliance reference table
CREATE TABLE IF NOT EXISTS public.carrier_alliances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_code TEXT NOT NULL UNIQUE,
  alliance_name TEXT NOT NULL,
  member_carriers JSONB NOT NULL DEFAULT '[]'::jsonb,
  interline_agreements JSONB NOT NULL DEFAULT '[]'::jsonb,
  validity_period DATERANGE NOT NULL,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create port/airport capability matrix
CREATE TABLE IF NOT EXISTS public.facility_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_code TEXT NOT NULL,
  facility_name TEXT NOT NULL,
  facility_type TEXT NOT NULL CHECK (facility_type IN ('port', 'airport', 'terminal', 'rail_yard')),
  location_code TEXT NOT NULL,
  equipment_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_vessel_size INTEGER,
  max_aircraft_size TEXT,
  handling_capacity_per_day INTEGER,
  congestion_factor NUMERIC(4,2) DEFAULT 1.0,
  operational_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, facility_code)
);

-- 4. Create origin-destination routing matrix
CREATE TABLE IF NOT EXISTS public.route_matrices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_code TEXT NOT NULL,
  destination_code TEXT NOT NULL,
  transport_mode TEXT NOT NULL,
  carrier_coverage JSONB NOT NULL DEFAULT '[]'::jsonb,
  transit_time_days INTEGER,
  frequency_per_week INTEGER,
  viability_score NUMERIC(3,2) DEFAULT 1.0,
  historical_performance NUMERIC(3,2) DEFAULT 1.0,
  geographic_constraints JSONB DEFAULT '{}'::jsonb,
  preferred_transshipment_hubs JSONB DEFAULT '[]'::jsonb,
  tenant_id UUID NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, origin_code, destination_code, transport_mode, valid_from)
);

-- 5. Enhanced commodity validation rules
ALTER TABLE public.rate_options 
ADD COLUMN IF NOT EXISTS ventilation_requirements TEXT,
ADD COLUMN IF NOT EXISTS stacking_restrictions TEXT,
ADD COLUMN IF NOT EXISTS special_handling_flags JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS documentation_requirements JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS security_level TEXT DEFAULT 'standard' CHECK (security_level IN ('standard', 'enhanced', 'high'));

ALTER TABLE public.rate_charge_rows
ADD COLUMN IF NOT EXISTS charge_type TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rate_charge_rows'
      AND column_name = 'charge_name'
  ) THEN
    UPDATE public.rate_charge_rows
    SET charge_type = COALESCE(charge_type, charge_name)
    WHERE charge_type IS NULL;
  END IF;
END $$;

ALTER TABLE public.rate_charge_cells
ADD COLUMN IF NOT EXISTS equipment_key TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rate_charge_cells'
      AND column_name = 'equipment_type'
  ) THEN
    UPDATE public.rate_charge_cells
    SET equipment_key = COALESCE(equipment_key, equipment_type)
    WHERE equipment_key IS NULL;
  END IF;
END $$;

-- 6. Create inter-modal transfer rules table
CREATE TABLE IF NOT EXISTS public.intermodal_transfer_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_mode TEXT NOT NULL,
  to_mode TEXT NOT NULL,
  min_transfer_time_hours INTEGER NOT NULL,
  max_transfer_time_hours INTEGER,
  equipment_compatibility_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  documentation_requirements JSONB DEFAULT '[]'::jsonb,
  customs_procedures JSONB DEFAULT '[]'::jsonb,
  security_screening_required BOOLEAN DEFAULT false,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, from_mode, to_mode)
);

-- 7. Create real-time surcharge calculation table
CREATE TABLE IF NOT EXISTS public.dynamic_surcharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surcharge_type TEXT NOT NULL CHECK (surcharge_type IN ('fuel', 'currency', 'peak_season', 'port_congestion', 'security')),
  applicable_modes JSONB NOT NULL DEFAULT '[]'::jsonb,
  calculation_method TEXT NOT NULL CHECK (calculation_method IN ('percentage', 'fixed', 'formula')),
  base_value NUMERIC(14,4),
  currency_code TEXT DEFAULT 'USD',
  validity_period DATERANGE NOT NULL,
  geographic_scope JSONB DEFAULT '{}'::jsonb,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Enable RLS on new tables
ALTER TABLE public.carrier_alliances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_matrices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intermodal_transfer_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_surcharges ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS policies for new tables
DO $$
BEGIN
  -- Carrier alliances RLS
  EXECUTE 'DROP POLICY IF EXISTS "tenant_isolation_carrier_alliances" ON public.carrier_alliances';
  EXECUTE 'CREATE POLICY "tenant_isolation_carrier_alliances" ON public.carrier_alliances FOR ALL USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)';
  
  -- Facility capabilities RLS
  EXECUTE 'DROP POLICY IF EXISTS "tenant_isolation_facility_capabilities" ON public.facility_capabilities';
  EXECUTE 'CREATE POLICY "tenant_isolation_facility_capabilities" ON public.facility_capabilities FOR ALL USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)';
  
  -- Route matrices RLS
  EXECUTE 'DROP POLICY IF EXISTS "tenant_isolation_route_matrices" ON public.route_matrices';
  EXECUTE 'CREATE POLICY "tenant_isolation_route_matrices" ON public.route_matrices FOR ALL USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)';
  
  -- Intermodal rules RLS
  EXECUTE 'DROP POLICY IF EXISTS "tenant_isolation_intermodal_transfer_rules" ON public.intermodal_transfer_rules';
  EXECUTE 'CREATE POLICY "tenant_isolation_intermodal_transfer_rules" ON public.intermodal_transfer_rules FOR ALL USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)';
  
  -- Dynamic surcharges RLS
  EXECUTE 'DROP POLICY IF EXISTS "tenant_isolation_dynamic_surcharges" ON public.dynamic_surcharges';
  EXECUTE 'CREATE POLICY "tenant_isolation_dynamic_surcharges" ON public.dynamic_surcharges FOR ALL USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)';
END $$;

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_route_matrices_origin_dest ON public.route_matrices(origin_code, destination_code, transport_mode);
CREATE INDEX IF NOT EXISTS idx_facility_capabilities_code ON public.facility_capabilities(facility_code);
CREATE INDEX IF NOT EXISTS idx_carrier_alliances_code ON public.carrier_alliances(alliance_code);
CREATE INDEX IF NOT EXISTS idx_intermodal_rules_modes ON public.intermodal_transfer_rules(from_mode, to_mode);
CREATE INDEX IF NOT EXISTS idx_dynamic_surcharges_type ON public.dynamic_surcharges(surcharge_type, validity_period);

-- 11. Insert initial data for NYC→Dehra Dun routing
INSERT INTO public.route_matrices (
  origin_code, destination_code, transport_mode, carrier_coverage, 
  transit_time_days, frequency_per_week, viability_score, tenant_id, valid_from, valid_to
) VALUES 
('JFK', 'DED', 'air', '["FedEx", "DHL", "UPS", "Emirates"]', 2, 7, 0.95, '00000000-0000-0000-0000-000000000000', '2024-01-01', '2024-12-31'),
('EWR', 'DED', 'air', '["FedEx", "DHL", "UPS"]', 2, 5, 0.90, '00000000-0000-0000-0000-000000000000', '2024-01-01', '2024-12-31'),
('NYC', 'DED', 'multimodal', '["Maersk", "MSC", "COSCO", "FedEx"]', 18, 3, 0.85, '00000000-0000-0000-0000-000000000000', '2024-01-01', '2024-12-31');

-- 12. Insert inter-modal transfer rules
INSERT INTO public.intermodal_transfer_rules (
  from_mode, to_mode, min_transfer_time_hours, equipment_compatibility_rules, tenant_id
) VALUES 
('ocean', 'air', 48, '{"requires": ["customs_clearance"], "equipment_changes": true}', '00000000-0000-0000-0000-000000000000'),
('air', 'road', 6, '{"requires": ["security_screening"], "equipment_changes": false}', '00000000-0000-0000-0000-000000000000'),
('road', 'rail', 12, '{"requires": [], "equipment_changes": true}', '00000000-0000-0000-0000-000000000000');

COMMENT ON TABLE public.carrier_alliances IS 'Carrier alliance and interline agreement definitions';
COMMENT ON TABLE public.facility_capabilities IS 'Port/airport/terminal capability matrices';
COMMENT ON TABLE public.route_matrices IS 'Origin-destination routing intelligence and carrier coverage';
COMMENT ON TABLE public.intermodal_transfer_rules IS 'Business rules for inter-modal transfers';
COMMENT ON TABLE public.dynamic_surcharges IS 'Real-time surcharge calculation parameters';

-- 13. Update the rate_matrix_view to include enhanced fields
DROP VIEW IF EXISTS public.rate_matrix_view;

CREATE VIEW public.rate_matrix_view AS
SELECT
  o.id AS rate_option_id,
  o.tenant_id,
  o.carrier_name,
  o.rate_type,
  o.transit_time_days,
  o.frequency_per_week,
  o.container_type,
  o.container_size,
  o.commodity_type,
  o.security_level,
  l."mode" AS transport_mode,
  l.sequence_no,
  l.origin_code AS leg_origin,
  l.destination_code AS leg_destination,
  l.carrier_alliance_code,
  l.service_level,
  l.capacity_available,
  r.charge_type,
  c.equipment_key,
  c.amount
FROM public.rate_options o
LEFT JOIN public.rate_option_legs l ON l.rate_option_id = o.id
LEFT JOIN public.rate_charge_rows r ON r.rate_option_id = o.id
LEFT JOIN public.rate_charge_cells c ON c.charge_row_id = r.id;
