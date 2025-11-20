-- Add leg_type and service_only_category columns to quotation_version_option_legs
ALTER TABLE quotation_version_option_legs 
ADD COLUMN leg_type TEXT DEFAULT 'transport' CHECK (leg_type IN ('transport', 'service')),
ADD COLUMN service_only_category TEXT;

-- Add index for leg_type queries
CREATE INDEX idx_quotation_version_option_legs_leg_type ON quotation_version_option_legs(leg_type);

-- Add comments for documentation
COMMENT ON COLUMN quotation_version_option_legs.leg_type IS 'Type of leg: transport (origin to destination movement) or service (stationary service like warehousing, customs, packing)';
COMMENT ON COLUMN quotation_version_option_legs.service_only_category IS 'Category for service-only legs: warehousing, customs, packing, inspection, etc. Only used when leg_type = service';

-- Create a helper function to validate service leg requirements
CREATE OR REPLACE FUNCTION validate_service_leg_requirements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If leg_type is 'service', service_only_category must be set
  IF NEW.leg_type = 'service' AND (NEW.service_only_category IS NULL OR NEW.service_only_category = '') THEN
    RAISE EXCEPTION 'service_only_category is required for service-type legs';
  END IF;
  
  -- If leg_type is 'transport', origin and destination should be set
  -- (We'll make this a soft validation since existing data might not comply)
  IF NEW.leg_type = 'transport' AND NEW.service_only_category IS NOT NULL THEN
    -- Clear service_only_category for transport legs
    NEW.service_only_category := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger to validate service leg requirements
CREATE TRIGGER validate_service_leg_before_insert_update
  BEFORE INSERT OR UPDATE ON quotation_version_option_legs
  FOR EACH ROW
  EXECUTE FUNCTION validate_service_leg_requirements();

-- Create a view for common service categories (for UI dropdowns)
CREATE TABLE service_leg_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon_name TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS policies for service_leg_categories
ALTER TABLE service_leg_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active service leg categories"
  ON service_leg_categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Platform admins can manage service leg categories"
  ON service_leg_categories FOR ALL
  USING (is_platform_admin(auth.uid()));

-- Populate default service leg categories
INSERT INTO service_leg_categories (code, name, description, icon_name, sort_order) VALUES
('warehousing', 'Warehousing & Storage', 'Storage, distribution, and warehouse services', 'Warehouse', 100),
('customs', 'Customs Clearance', 'Import/export customs brokerage and clearance', 'FileCheck', 200),
('packing', 'Packing & Crating', 'Professional packing, crating, and palletization', 'Package', 300),
('inspection', 'Quality Inspection', 'Pre-shipment inspection and quality control', 'Search', 400),
('insurance', 'Cargo Insurance', 'Insurance coverage and documentation', 'Shield', 500),
('documentation', 'Documentation Services', 'Bill of lading, certificates, permits', 'FileText', 600),
('fumigation', 'Fumigation & Treatment', 'Pest control and cargo treatment services', 'Bug', 700),
('consolidation', 'Consolidation Services', 'Cargo consolidation and deconsolidation', 'Package2', 800),
('sorting', 'Sorting & Labeling', 'Cargo sorting, labeling, and marking', 'SortAsc', 900),
('other', 'Other Services', 'Miscellaneous service-only offerings', 'MoreHorizontal', 1000);

-- Add trigger for updated_at
CREATE TRIGGER update_service_leg_categories_updated_at
  BEFORE UPDATE ON service_leg_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE service_leg_categories IS 'Predefined categories for service-only legs (warehousing, customs, etc.)';