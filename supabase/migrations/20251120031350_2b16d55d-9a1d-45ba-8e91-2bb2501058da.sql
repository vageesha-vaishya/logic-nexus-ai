-- ================================================
-- Phase 5: Provider-Specific Workflows
-- ================================================
-- This migration adds support for carrier-specific configurations,
-- rate structures, and API integration readiness.

-- ================================================
-- 1. Provider Rate Templates
-- ================================================
-- Define how different carriers structure their rates
CREATE TABLE IF NOT EXISTS provider_rate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  carrier_id UUID NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
  service_type_id UUID REFERENCES service_types(id) ON DELETE SET NULL,
  
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL, -- 'weight_based', 'zone_based', 'distance_based', 'flat_rate'
  
  -- Rate structure configuration
  rate_structure JSONB NOT NULL DEFAULT '{}', -- Provider-specific rate structure
  
  -- Validation rules
  min_chargeable_weight NUMERIC,
  max_chargeable_weight NUMERIC,
  requires_dimensional_weight BOOLEAN DEFAULT false,
  requires_origin_destination BOOLEAN DEFAULT true,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  effective_until TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT provider_rate_templates_unique UNIQUE(carrier_id, service_type_id, template_name)
);

-- ================================================
-- 2. Provider Charge Mappings
-- ================================================
-- Map internal charge types to provider-specific charge codes
CREATE TABLE IF NOT EXISTS provider_charge_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  carrier_id UUID NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
  
  -- Internal charge reference
  charge_category_id UUID REFERENCES charge_categories(id) ON DELETE SET NULL,
  charge_basis_id UUID REFERENCES charge_bases(id) ON DELETE SET NULL,
  
  -- Provider-specific details
  provider_charge_code TEXT NOT NULL,
  provider_charge_name TEXT NOT NULL,
  provider_charge_description TEXT,
  
  -- Calculation rules
  calculation_method TEXT, -- 'fixed', 'percentage', 'per_unit', 'tiered'
  default_rate NUMERIC,
  currency_id UUID REFERENCES currencies(id) ON DELETE SET NULL,
  
  -- Conditions
  applies_to_service_types TEXT[], -- Array of service type codes
  min_shipment_value NUMERIC,
  max_shipment_value NUMERIC,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT provider_charge_mappings_unique UNIQUE(carrier_id, provider_charge_code)
);

-- ================================================
-- 3. Provider API Configurations
-- ================================================
-- Store API credentials and endpoints for carrier integrations
CREATE TABLE IF NOT EXISTS provider_api_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  carrier_id UUID NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
  
  -- API details
  api_provider TEXT NOT NULL, -- 'fedex', 'ups', 'dhl', 'custom'
  api_version TEXT,
  
  -- Endpoints
  base_url TEXT NOT NULL,
  rate_endpoint TEXT,
  tracking_endpoint TEXT,
  label_endpoint TEXT,
  
  -- Authentication
  auth_type TEXT NOT NULL, -- 'api_key', 'oauth', 'basic', 'bearer'
  auth_config JSONB NOT NULL DEFAULT '{}', -- Encrypted credentials
  
  -- Rate limiting
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_day INTEGER,
  
  -- Features
  supports_rate_shopping BOOLEAN DEFAULT false,
  supports_tracking BOOLEAN DEFAULT false,
  supports_label_generation BOOLEAN DEFAULT false,
  supports_document_upload BOOLEAN DEFAULT false,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_health_check TIMESTAMP WITH TIME ZONE,
  health_status TEXT, -- 'healthy', 'degraded', 'down'
  
  -- Metadata
  timeout_seconds INTEGER DEFAULT 30,
  retry_attempts INTEGER DEFAULT 3,
  custom_headers JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT provider_api_configs_unique UNIQUE(tenant_id, carrier_id)
);

-- ================================================
-- 4. Provider Rate Rules
-- ================================================
-- Define provider-specific business rules and validations
CREATE TABLE IF NOT EXISTS provider_rate_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  carrier_id UUID NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
  service_type_id UUID REFERENCES service_types(id) ON DELETE CASCADE,
  
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- 'surcharge', 'discount', 'validation', 'calculation'
  
  -- Conditions
  conditions JSONB NOT NULL DEFAULT '{}', -- When this rule applies
  
  -- Actions
  actions JSONB NOT NULL DEFAULT '{}', -- What to do when conditions are met
  
  -- Priority
  priority INTEGER DEFAULT 100, -- Lower numbers execute first
  
  -- Validation
  validation_message TEXT, -- Custom message for validation rules
  is_blocking BOOLEAN DEFAULT false, -- If validation fails, block the quote
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================
-- 5. Provider Surcharge Definitions
-- ================================================
-- Define carrier-specific surcharges
CREATE TABLE IF NOT EXISTS provider_surcharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  carrier_id UUID NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
  
  surcharge_code TEXT NOT NULL,
  surcharge_name TEXT NOT NULL,
  surcharge_description TEXT,
  
  -- Calculation
  calculation_type TEXT NOT NULL, -- 'fixed', 'percentage', 'per_unit', 'tiered'
  rate NUMERIC,
  currency_id UUID REFERENCES currencies(id) ON DELETE SET NULL,
  
  -- Application rules
  applies_to_service_types TEXT[],
  applies_to_weight_range JSONB, -- {min: 0, max: 1000}
  applies_to_zones TEXT[],
  applies_to_countries TEXT[],
  
  -- Conditions
  requires_special_handling BOOLEAN DEFAULT false,
  requires_hazmat BOOLEAN DEFAULT false,
  requires_temperature_control BOOLEAN DEFAULT false,
  
  -- Validity
  effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  effective_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT provider_surcharges_unique UNIQUE(carrier_id, surcharge_code)
);

-- ================================================
-- Indexes
-- ================================================
CREATE INDEX IF NOT EXISTS idx_provider_rate_templates_carrier ON provider_rate_templates(carrier_id);
CREATE INDEX IF NOT EXISTS idx_provider_rate_templates_service_type ON provider_rate_templates(service_type_id);
CREATE INDEX IF NOT EXISTS idx_provider_rate_templates_active ON provider_rate_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_provider_charge_mappings_carrier ON provider_charge_mappings(carrier_id);
CREATE INDEX IF NOT EXISTS idx_provider_charge_mappings_category ON provider_charge_mappings(charge_category_id);
CREATE INDEX IF NOT EXISTS idx_provider_charge_mappings_active ON provider_charge_mappings(is_active);

CREATE INDEX IF NOT EXISTS idx_provider_api_configs_carrier ON provider_api_configs(carrier_id);
CREATE INDEX IF NOT EXISTS idx_provider_api_configs_active ON provider_api_configs(is_active);

CREATE INDEX IF NOT EXISTS idx_provider_rate_rules_carrier ON provider_rate_rules(carrier_id);
CREATE INDEX IF NOT EXISTS idx_provider_rate_rules_service_type ON provider_rate_rules(service_type_id);
CREATE INDEX IF NOT EXISTS idx_provider_rate_rules_priority ON provider_rate_rules(priority);
CREATE INDEX IF NOT EXISTS idx_provider_rate_rules_active ON provider_rate_rules(is_active);

CREATE INDEX IF NOT EXISTS idx_provider_surcharges_carrier ON provider_surcharges(carrier_id);
CREATE INDEX IF NOT EXISTS idx_provider_surcharges_active ON provider_surcharges(is_active);

-- ================================================
-- Row Level Security (RLS)
-- ================================================

-- Provider Rate Templates
ALTER TABLE provider_rate_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins full access to provider rate templates"
  ON provider_rate_templates
  FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins manage provider rate templates"
  ON provider_rate_templates
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'tenant_admin') 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users view tenant provider rate templates"
  ON provider_rate_templates
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Provider Charge Mappings
ALTER TABLE provider_charge_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins full access to provider charge mappings"
  ON provider_charge_mappings
  FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins manage provider charge mappings"
  ON provider_charge_mappings
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'tenant_admin') 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users view tenant provider charge mappings"
  ON provider_charge_mappings
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Provider API Configurations
ALTER TABLE provider_api_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins full access to provider api configs"
  ON provider_api_configs
  FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins manage provider api configs"
  ON provider_api_configs
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'tenant_admin') 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

-- Provider Rate Rules
ALTER TABLE provider_rate_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins full access to provider rate rules"
  ON provider_rate_rules
  FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins manage provider rate rules"
  ON provider_rate_rules
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'tenant_admin') 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users view tenant provider rate rules"
  ON provider_rate_rules
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Provider Surcharges
ALTER TABLE provider_surcharges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins full access to provider surcharges"
  ON provider_surcharges
  FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins manage provider surcharges"
  ON provider_surcharges
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'tenant_admin') 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users view tenant provider surcharges"
  ON provider_surcharges
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- ================================================
-- Triggers for updated_at
-- ================================================
CREATE TRIGGER update_provider_rate_templates_updated_at
  BEFORE UPDATE ON provider_rate_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_charge_mappings_updated_at
  BEFORE UPDATE ON provider_charge_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_api_configs_updated_at
  BEFORE UPDATE ON provider_api_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_rate_rules_updated_at
  BEFORE UPDATE ON provider_rate_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_surcharges_updated_at
  BEFORE UPDATE ON provider_surcharges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- Helper Functions
-- ================================================

-- Function to get applicable provider surcharges for a shipment
CREATE OR REPLACE FUNCTION get_applicable_provider_surcharges(
  p_carrier_id UUID,
  p_service_type TEXT,
  p_weight_kg NUMERIC,
  p_country_code TEXT DEFAULT NULL,
  p_is_hazmat BOOLEAN DEFAULT false,
  p_is_temperature_controlled BOOLEAN DEFAULT false
)
RETURNS TABLE (
  surcharge_id UUID,
  surcharge_code TEXT,
  surcharge_name TEXT,
  calculation_type TEXT,
  rate NUMERIC,
  currency_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.id,
    ps.surcharge_code,
    ps.surcharge_name,
    ps.calculation_type,
    ps.rate,
    c.code as currency_code
  FROM provider_surcharges ps
  LEFT JOIN currencies c ON c.id = ps.currency_id
  WHERE 
    ps.carrier_id = p_carrier_id
    AND ps.is_active = true
    AND now() BETWEEN ps.effective_from AND COALESCE(ps.effective_until, 'infinity'::timestamp)
    AND (
      ps.applies_to_service_types IS NULL 
      OR p_service_type = ANY(ps.applies_to_service_types)
    )
    AND (
      ps.applies_to_weight_range IS NULL
      OR (
        p_weight_kg >= COALESCE((ps.applies_to_weight_range->>'min')::numeric, 0)
        AND p_weight_kg <= COALESCE((ps.applies_to_weight_range->>'max')::numeric, 999999)
      )
    )
    AND (
      ps.applies_to_countries IS NULL
      OR p_country_code = ANY(ps.applies_to_countries)
    )
    AND (
      NOT ps.requires_hazmat OR p_is_hazmat
    )
    AND (
      NOT ps.requires_temperature_control OR p_is_temperature_controlled
    )
  ORDER BY ps.surcharge_code;
END;
$$;

-- Function to evaluate provider rate rules
CREATE OR REPLACE FUNCTION evaluate_provider_rate_rules(
  p_carrier_id UUID,
  p_service_type_id UUID,
  p_quote_data JSONB
)
RETURNS TABLE (
  rule_id UUID,
  rule_name TEXT,
  rule_type TEXT,
  actions JSONB,
  validation_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    prr.id,
    prr.rule_name,
    prr.rule_type,
    prr.actions,
    prr.validation_message
  FROM provider_rate_rules prr
  WHERE 
    prr.carrier_id = p_carrier_id
    AND (prr.service_type_id IS NULL OR prr.service_type_id = p_service_type_id)
    AND prr.is_active = true
    -- Note: Actual condition evaluation would be done in application logic
  ORDER BY prr.priority ASC;
END;
$$;