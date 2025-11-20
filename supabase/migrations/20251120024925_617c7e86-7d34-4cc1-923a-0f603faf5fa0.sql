-- Create charge_tier_config table for defining tiered pricing rules
CREATE TABLE charge_tier_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  basis_id UUID REFERENCES charge_bases(id), -- links to 'Per KG', 'Per CBM', etc.
  category_id UUID REFERENCES charge_categories(id), -- optional: specific charge category
  service_type_id UUID REFERENCES service_types(id), -- optional: specific service type
  carrier_id UUID REFERENCES carriers(id), -- optional: carrier-specific tiers
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_tier_config_name UNIQUE (tenant_id, name)
);

-- Create charge_tier_ranges table for individual tier levels
CREATE TABLE charge_tier_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_config_id UUID NOT NULL REFERENCES charge_tier_config(id) ON DELETE CASCADE,
  min_value NUMERIC NOT NULL CHECK (min_value >= 0),
  max_value NUMERIC CHECK (max_value IS NULL OR max_value > min_value), -- NULL = infinity
  rate NUMERIC NOT NULL CHECK (rate >= 0),
  currency_id UUID REFERENCES currencies(id),
  sort_order INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_charge_tier_config_tenant ON charge_tier_config(tenant_id);
CREATE INDEX idx_charge_tier_config_basis ON charge_tier_config(basis_id);
CREATE INDEX idx_charge_tier_config_category ON charge_tier_config(category_id);
CREATE INDEX idx_charge_tier_config_service_type ON charge_tier_config(service_type_id);
CREATE INDEX idx_charge_tier_config_carrier ON charge_tier_config(carrier_id);
CREATE INDEX idx_charge_tier_ranges_config ON charge_tier_ranges(tier_config_id);
CREATE INDEX idx_charge_tier_ranges_values ON charge_tier_ranges(min_value, max_value);

-- Add RLS policies for charge_tier_config
ALTER TABLE charge_tier_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage all tier configs"
  ON charge_tier_config FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tier configs"
  ON charge_tier_config FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view tenant tier configs"
  ON charge_tier_config FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Add RLS policies for charge_tier_ranges
ALTER TABLE charge_tier_ranges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can manage all tier ranges"
  ON charge_tier_ranges FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tier ranges"
  ON charge_tier_ranges FOR ALL
  USING (
    tier_config_id IN (
      SELECT id FROM charge_tier_config 
      WHERE tenant_id = get_user_tenant_id(auth.uid())
    )
  );

CREATE POLICY "Users can view tenant tier ranges"
  ON charge_tier_ranges FOR SELECT
  USING (
    tier_config_id IN (
      SELECT id FROM charge_tier_config 
      WHERE tenant_id = get_user_tenant_id(auth.uid())
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_charge_tier_config_updated_at
  BEFORE UPDATE ON charge_tier_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_charge_tier_ranges_updated_at
  BEFORE UPDATE ON charge_tier_ranges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add helper function to get applicable rate for a given value
CREATE OR REPLACE FUNCTION get_tier_rate(
  p_tier_config_id UUID,
  p_value NUMERIC
) RETURNS TABLE(
  range_id UUID,
  rate NUMERIC,
  currency_id UUID,
  min_value NUMERIC,
  max_value NUMERIC
) 
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    id,
    rate,
    currency_id,
    min_value,
    max_value
  FROM charge_tier_ranges
  WHERE tier_config_id = p_tier_config_id
    AND min_value <= p_value
    AND (max_value IS NULL OR max_value >= p_value)
  ORDER BY sort_order, min_value
  LIMIT 1;
$$;

-- Add comments for documentation
COMMENT ON TABLE charge_tier_config IS 'Defines tiered pricing configurations for weight, volume, or other measurable units';
COMMENT ON TABLE charge_tier_ranges IS 'Individual tier ranges with rates for each configuration';
COMMENT ON COLUMN charge_tier_config.basis_id IS 'Links to charge_bases (Per KG, Per CBM, etc.)';
COMMENT ON COLUMN charge_tier_ranges.max_value IS 'NULL indicates unlimited (infinity)';
COMMENT ON FUNCTION get_tier_rate IS 'Returns the applicable tier rate for a given value';