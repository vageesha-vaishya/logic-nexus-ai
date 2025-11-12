-- ==========================================
-- PHASE 4: QUOTES & SHIPMENTS TABLES
-- ==========================================
-- Execute this after Phase 3

-- Drop existing quotes and shipments tables
DROP TABLE IF EXISTS tracking_events CASCADE;
DROP TABLE IF EXISTS cargo_details CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS rate_calculations CASCADE;
DROP TABLE IF EXISTS customer_selections CASCADE;
DROP TABLE IF EXISTS quote_packages CASCADE;
DROP TABLE IF EXISTS quote_charges CASCADE;
DROP TABLE IF EXISTS quote_legs CASCADE;
DROP TABLE IF EXISTS quotation_version_options CASCADE;
DROP TABLE IF EXISTS quotation_versions CASCADE;
DROP TABLE IF EXISTS quotes CASCADE;
DROP TABLE IF EXISTS shipping_rates CASCADE;
DROP TABLE IF EXISTS carrier_rate_charges CASCADE;
DROP TABLE IF EXISTS carrier_rates CASCADE;
DROP TABLE IF EXISTS services CASCADE;

-- Services
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_type_id UUID REFERENCES service_types(id) ON DELETE SET NULL,
  service_code TEXT NOT NULL,
  service_name TEXT NOT NULL,
  service_type TEXT NOT NULL,
  description TEXT,
  pricing_unit TEXT,
  base_price NUMERIC,
  transit_time_days INTEGER,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Carrier Rates
CREATE TABLE IF NOT EXISTS carrier_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  carrier_id UUID REFERENCES carriers(id) ON DELETE CASCADE,
  service_type_id UUID REFERENCES service_types(id) ON DELETE SET NULL,
  origin_port_id UUID REFERENCES ports_locations(id) ON DELETE SET NULL,
  destination_port_id UUID REFERENCES ports_locations(id) ON DELETE SET NULL,
  container_type_id UUID REFERENCES container_types(id) ON DELETE SET NULL,
  container_size_id UUID REFERENCES container_sizes(id) ON DELETE SET NULL,
  base_rate NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  valid_from DATE NOT NULL,
  valid_until DATE,
  transit_time_days INTEGER,
  is_active BOOLEAN DEFAULT true,
  rate_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Carrier Rate Charges
CREATE TABLE IF NOT EXISTS carrier_rate_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  carrier_rate_id UUID NOT NULL REFERENCES carrier_rates(id) ON DELETE CASCADE,
  charge_type TEXT NOT NULL,
  basis TEXT,
  quantity NUMERIC DEFAULT 1,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Shipping Rates
CREATE TABLE IF NOT EXISTS shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shipment_type shipment_type NOT NULL,
  service_level TEXT,
  origin_country TEXT,
  destination_country TEXT,
  origin_zone TEXT,
  destination_zone TEXT,
  min_weight_kg NUMERIC,
  max_weight_kg NUMERIC,
  rate_per_kg NUMERIC,
  base_rate NUMERIC,
  currency TEXT DEFAULT 'USD',
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Quotes
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES franchises(id) ON DELETE SET NULL,
  quote_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  carrier_id UUID REFERENCES carriers(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  consignee_id UUID REFERENCES consignees(id) ON DELETE SET NULL,
  incoterm_id UUID REFERENCES incoterms(id) ON DELETE SET NULL,
  service_type_id UUID REFERENCES service_types(id) ON DELETE SET NULL,
  origin_port_id UUID REFERENCES ports_locations(id) ON DELETE SET NULL,
  destination_port_id UUID REFERENCES ports_locations(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  valid_until DATE,
  currency TEXT DEFAULT 'USD',
  subtotal NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  tax_percent NUMERIC DEFAULT 0,
  shipping_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  cost_price NUMERIC,
  sell_price NUMERIC,
  margin_amount NUMERIC,
  margin_percentage NUMERIC,
  billing_address JSONB DEFAULT '{}',
  shipping_address JSONB DEFAULT '{}',
  origin_location JSONB DEFAULT '{}',
  destination_location JSONB DEFAULT '{}',
  cargo_details JSONB DEFAULT '{}',
  additional_costs JSONB DEFAULT '[]',
  special_handling JSONB DEFAULT '[]',
  regulatory_data JSONB DEFAULT '{}',
  terms_conditions TEXT,
  payment_terms TEXT,
  notes TEXT,
  incoterms TEXT,
  compliance_status TEXT DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ
);

-- Quotation Versions
CREATE TABLE IF NOT EXISTS quotation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Quotation Version Options
CREATE TABLE IF NOT EXISTS quotation_version_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quotation_version_id UUID NOT NULL REFERENCES quotation_versions(id) ON DELETE CASCADE,
  option_name TEXT NOT NULL,
  option_number INTEGER NOT NULL,
  total_amount NUMERIC DEFAULT 0,
  description TEXT,
  is_recommended BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Quote Legs
CREATE TABLE IF NOT EXISTS quote_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_option_id UUID NOT NULL REFERENCES quotation_version_options(id) ON DELETE CASCADE,
  leg_number INTEGER NOT NULL,
  origin_location_id UUID REFERENCES ports_locations(id) ON DELETE SET NULL,
  destination_location_id UUID REFERENCES ports_locations(id) ON DELETE SET NULL,
  carrier_id UUID REFERENCES carriers(id) ON DELETE SET NULL,
  service_type TEXT,
  estimated_duration_days INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Quote Charges
CREATE TABLE IF NOT EXISTS quote_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_option_id UUID NOT NULL REFERENCES quotation_version_options(id) ON DELETE CASCADE,
  leg_id UUID REFERENCES quote_legs(id) ON DELETE CASCADE,
  charge_side_id UUID REFERENCES charge_sides(id) ON DELETE SET NULL,
  category_id UUID REFERENCES charge_categories(id) ON DELETE SET NULL,
  basis_id UUID REFERENCES charge_bases(id) ON DELETE SET NULL,
  unit TEXT,
  quantity NUMERIC DEFAULT 1,
  rate NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  currency_id UUID REFERENCES currencies(id) ON DELETE SET NULL,
  note TEXT,
  sort_order INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Quote Packages
CREATE TABLE IF NOT EXISTS quote_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  package_type_id UUID REFERENCES package_categories(id) ON DELETE SET NULL,
  quantity INTEGER DEFAULT 1,
  weight_kg NUMERIC,
  dimensions_cm JSONB,
  volume_cbm NUMERIC,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Customer Selections
CREATE TABLE IF NOT EXISTS customer_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  quotation_version_id UUID NOT NULL REFERENCES quotation_versions(id) ON DELETE CASCADE,
  quotation_version_option_id UUID NOT NULL REFERENCES quotation_version_options(id) ON DELETE CASCADE,
  selected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  selected_at TIMESTAMPTZ DEFAULT now(),
  reason TEXT
);

-- Rate Calculations
CREATE TABLE IF NOT EXISTS rate_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  carrier_rate_id UUID REFERENCES carrier_rates(id) ON DELETE SET NULL,
  calculation_breakdown JSONB NOT NULL,
  applied_surcharges JSONB DEFAULT '[]',
  applied_discounts JSONB DEFAULT '[]',
  final_rate NUMERIC NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  calculated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Shipments
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES franchises(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  shipment_number TEXT NOT NULL,
  shipment_type shipment_type NOT NULL,
  status TEXT DEFAULT 'draft',
  carrier_id UUID REFERENCES carriers(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  origin_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  destination_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  origin_location JSONB,
  destination_location JSONB,
  pickup_date DATE,
  delivery_date DATE,
  estimated_delivery DATE,
  actual_delivery DATE,
  total_weight_kg NUMERIC,
  total_volume_cbm NUMERIC,
  total_cost NUMERIC,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cargo Details
CREATE TABLE IF NOT EXISTS cargo_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  cargo_type_id UUID REFERENCES cargo_types(id) ON DELETE SET NULL,
  service_type TEXT,
  commodity_description TEXT,
  hs_code TEXT,
  weight_kg NUMERIC,
  volume_cbm NUMERIC,
  dimensions_cm JSONB,
  value_amount NUMERIC,
  value_currency TEXT DEFAULT 'USD',
  is_hazardous BOOLEAN DEFAULT false,
  hazmat_un_number TEXT,
  hazmat_class TEXT,
  temperature_controlled BOOLEAN DEFAULT false,
  temperature_range JSONB,
  special_requirements TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tracking Events
CREATE TABLE IF NOT EXISTS tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_status TEXT NOT NULL,
  location JSONB,
  description TEXT,
  notes TEXT,
  event_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_services_tenant ON services(tenant_id);
CREATE INDEX idx_carrier_rates_carrier ON carrier_rates(carrier_id);
CREATE INDEX idx_quotes_tenant ON quotes(tenant_id);
CREATE INDEX idx_quotes_franchise ON quotes(franchise_id);
CREATE INDEX idx_quotes_opportunity ON quotes(opportunity_id);
CREATE INDEX idx_quotation_versions_quote ON quotation_versions(quote_id);
CREATE INDEX idx_shipments_tenant ON shipments(tenant_id);
CREATE INDEX idx_shipments_franchise ON shipments(franchise_id);
CREATE INDEX idx_shipments_quote ON shipments(quote_id);
CREATE INDEX idx_tracking_events_shipment ON tracking_events(shipment_id);

-- Triggers
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
