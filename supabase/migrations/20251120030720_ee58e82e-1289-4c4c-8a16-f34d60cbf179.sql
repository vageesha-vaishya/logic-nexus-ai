-- Phase 4.1: Weight Break Support
-- Create charge_weight_breaks table for defining weight-based tiered pricing
CREATE TABLE charge_weight_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  carrier_id UUID REFERENCES carriers(id) ON DELETE CASCADE,
  service_type_id UUID REFERENCES service_types(id),
  name TEXT NOT NULL,
  description TEXT,
  min_weight_kg NUMERIC NOT NULL CHECK (min_weight_kg >= 0),
  max_weight_kg NUMERIC CHECK (max_weight_kg IS NULL OR max_weight_kg > min_weight_kg),
  rate_per_kg NUMERIC NOT NULL CHECK (rate_per_kg >= 0),
  currency_id UUID REFERENCES currencies(id),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_effective_dates CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

-- Add indexes for performance
CREATE INDEX idx_charge_weight_breaks_tenant ON charge_weight_breaks(tenant_id);
CREATE INDEX idx_charge_weight_breaks_carrier ON charge_weight_breaks(carrier_id);
CREATE INDEX idx_charge_weight_breaks_service_type ON charge_weight_breaks(service_type_id);
CREATE INDEX idx_charge_weight_breaks_weight ON charge_weight_breaks(min_weight_kg, max_weight_kg);
CREATE INDEX idx_charge_weight_breaks_dates ON charge_weight_breaks(effective_from, effective_until);

-- Phase 4.2: Dimensional Weight Support
-- Add dimensional weight flag to service_types
ALTER TABLE service_types 
ADD COLUMN use_dimensional_weight BOOLEAN DEFAULT false,
ADD COLUMN dim_divisor NUMERIC DEFAULT 6000 CHECK (dim_divisor > 0);

COMMENT ON COLUMN service_types.use_dimensional_weight IS 'Whether to calculate chargeable weight using dimensional (volumetric) weight';
COMMENT ON COLUMN service_types.dim_divisor IS 'Divisor for dimensional weight calculation (L×W×H)/divisor. Default 6000 for air freight';

-- Add dimensional weight calculation to cargo_details (already has dimensions_cm)
ALTER TABLE cargo_details
ADD COLUMN actual_weight_kg NUMERIC CHECK (actual_weight_kg IS NULL OR actual_weight_kg >= 0),
ADD COLUMN volumetric_weight_kg NUMERIC CHECK (volumetric_weight_kg IS NULL OR volumetric_weight_kg >= 0),
ADD COLUMN chargeable_weight_kg NUMERIC CHECK (chargeable_weight_kg IS NULL OR chargeable_weight_kg >= 0);

COMMENT ON COLUMN cargo_details.actual_weight_kg IS 'Physical weight of the cargo';
COMMENT ON COLUMN cargo_details.volumetric_weight_kg IS 'Calculated volumetric/dimensional weight';
COMMENT ON COLUMN cargo_details.chargeable_weight_kg IS 'Weight used for pricing (greater of actual or volumetric)';

-- Create function to calculate dimensional weight
CREATE OR REPLACE FUNCTION calculate_dimensional_weight(
  p_length_cm NUMERIC,
  p_width_cm NUMERIC,
  p_height_cm NUMERIC,
  p_divisor NUMERIC DEFAULT 6000
) RETURNS NUMERIC
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public'
AS $$
  SELECT CASE 
    WHEN p_length_cm IS NULL OR p_width_cm IS NULL OR p_height_cm IS NULL OR p_divisor <= 0 
    THEN NULL
    ELSE (p_length_cm * p_width_cm * p_height_cm) / p_divisor
  END;
$$;

-- Create function to get chargeable weight
CREATE OR REPLACE FUNCTION get_chargeable_weight(
  p_actual_weight_kg NUMERIC,
  p_volumetric_weight_kg NUMERIC
) RETURNS NUMERIC
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public'
AS $$
  SELECT GREATEST(
    COALESCE(p_actual_weight_kg, 0),
    COALESCE(p_volumetric_weight_kg, 0)
  );
$$;

-- Phase 4.3: Container Type Variations
-- Add container ownership and special types to container_types
ALTER TABLE container_types
ADD COLUMN ownership_type TEXT CHECK (ownership_type IN ('COC', 'SOC', 'BOTH', NULL)),
ADD COLUMN is_special BOOLEAN DEFAULT false,
ADD COLUMN special_type TEXT;

COMMENT ON COLUMN container_types.ownership_type IS 'COC (Carrier Owned), SOC (Shipper Owned), or BOTH';
COMMENT ON COLUMN container_types.is_special IS 'Whether this is a special container type (Open Top, Flat Rack, etc.)';
COMMENT ON COLUMN container_types.special_type IS 'Type of special container: open_top, flat_rack, tank, refrigerated, etc.';

-- Add special container attributes to container_sizes
ALTER TABLE container_sizes
ADD COLUMN has_ventilation BOOLEAN DEFAULT false,
ADD COLUMN has_temperature_control BOOLEAN DEFAULT false,
ADD COLUMN is_open_top BOOLEAN DEFAULT false,
ADD COLUMN is_flat_rack BOOLEAN DEFAULT false;

-- Insert common container ownership variants
INSERT INTO container_types (name, code, ownership_type, is_active, is_special, special_type) VALUES
('Dry COC', 'DRY_COC', 'COC', true, false, NULL),
('Dry SOC', 'DRY_SOC', 'SOC', true, false, NULL),
('Reefer COC', 'REEFER_COC', 'COC', true, true, 'refrigerated'),
('Reefer SOC', 'REEFER_SOC', 'SOC', true, true, 'refrigerated'),
('Open Top', 'OPEN_TOP', 'BOTH', true, true, 'open_top'),
('Flat Rack', 'FLAT_RACK', 'BOTH', true, true, 'flat_rack'),
('Tank Container', 'TANK', 'BOTH', true, true, 'tank')
ON CONFLICT (code) DO NOTHING;

-- Add RLS policies for charge_weight_breaks
ALTER TABLE charge_weight_breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage all weight breaks"
  ON charge_weight_breaks FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage weight breaks"
  ON charge_weight_breaks FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view tenant weight breaks"
  ON charge_weight_breaks FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_charge_weight_breaks_updated_at
  BEFORE UPDATE ON charge_weight_breaks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add helper function to find applicable weight break rate
CREATE OR REPLACE FUNCTION get_weight_break_rate(
  p_tenant_id UUID,
  p_carrier_id UUID,
  p_service_type_id UUID,
  p_weight_kg NUMERIC,
  p_effective_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE(
  id UUID,
  rate_per_kg NUMERIC,
  currency_id UUID,
  min_weight_kg NUMERIC,
  max_weight_kg NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    id,
    rate_per_kg,
    currency_id,
    min_weight_kg,
    max_weight_kg
  FROM charge_weight_breaks
  WHERE tenant_id = p_tenant_id
    AND (carrier_id = p_carrier_id OR carrier_id IS NULL)
    AND (service_type_id = p_service_type_id OR service_type_id IS NULL)
    AND min_weight_kg <= p_weight_kg
    AND (max_weight_kg IS NULL OR max_weight_kg >= p_weight_kg)
    AND effective_from <= p_effective_date
    AND (effective_until IS NULL OR effective_until >= p_effective_date)
    AND is_active = true
  ORDER BY 
    CASE WHEN carrier_id IS NOT NULL THEN 1 ELSE 2 END,
    CASE WHEN service_type_id IS NOT NULL THEN 1 ELSE 2 END,
    min_weight_kg DESC
  LIMIT 1;
$$;

-- Add comments
COMMENT ON TABLE charge_weight_breaks IS 'Weight-based tiered pricing for carriers (e.g., air freight 0-45kg, 45-100kg, 100+)';
COMMENT ON FUNCTION calculate_dimensional_weight IS 'Calculates volumetric weight: (L×W×H)/divisor';
COMMENT ON FUNCTION get_chargeable_weight IS 'Returns the greater of actual weight or volumetric weight';
COMMENT ON FUNCTION get_weight_break_rate IS 'Finds the applicable weight break rate for given parameters';