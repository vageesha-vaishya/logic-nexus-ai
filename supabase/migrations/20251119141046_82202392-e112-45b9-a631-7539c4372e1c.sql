-- Phase 2 Prep: Add franchise_id to quotation tables (handling NULLs)

-- Step 1: Add franchise_id columns (nullable)
ALTER TABLE quotation_versions ADD COLUMN franchise_id UUID REFERENCES franchises(id);
ALTER TABLE quotation_version_options ADD COLUMN franchise_id UUID REFERENCES franchises(id);
ALTER TABLE quotation_version_option_legs ADD COLUMN franchise_id UUID REFERENCES franchises(id);
ALTER TABLE quote_charges ADD COLUMN franchise_id UUID REFERENCES franchises(id);

-- Step 2: Backfill franchise_id from quotes table
UPDATE quotation_versions qv
SET franchise_id = q.franchise_id
FROM quotes q
WHERE qv.quote_id = q.id;

UPDATE quotation_version_options qvo
SET franchise_id = qv.franchise_id
FROM quotation_versions qv
WHERE qvo.quotation_version_id = qv.id;

UPDATE quotation_version_option_legs qvol
SET franchise_id = qvo.franchise_id
FROM quotation_version_options qvo
WHERE qvol.quotation_version_option_id = qvo.id;

UPDATE quote_charges qc
SET franchise_id = qvol.franchise_id
FROM quotation_version_option_legs qvol
WHERE qc.leg_id = qvol.id;

-- Step 3: Add indexes for performance
CREATE INDEX idx_quotation_versions_franchise ON quotation_versions(franchise_id);
CREATE INDEX idx_quotation_version_options_franchise ON quotation_version_options(franchise_id);
CREATE INDEX idx_quotation_version_option_legs_franchise ON quotation_version_option_legs(franchise_id);
CREATE INDEX idx_quote_charges_franchise ON quote_charges(franchise_id);

-- Step 4: Drop old complex RLS policies
DROP POLICY IF EXISTS "Platform admins can manage all quotation versions" ON quotation_versions;
DROP POLICY IF EXISTS "Tenant admins can manage tenant quotation versions" ON quotation_versions;
DROP POLICY IF EXISTS "Users can create franchise quotation versions" ON quotation_versions;
DROP POLICY IF EXISTS "Users can view franchise quotation versions" ON quotation_versions;

DROP POLICY IF EXISTS "Platform admins can manage all quotation options" ON quotation_version_options;
DROP POLICY IF EXISTS "Tenant admins can manage tenant quotation options" ON quotation_version_options;
DROP POLICY IF EXISTS "Users can create franchise quotation options" ON quotation_version_options;
DROP POLICY IF EXISTS "Users can view franchise quotation options" ON quotation_version_options;

DROP POLICY IF EXISTS "Platform admins can manage all option legs" ON quotation_version_option_legs;
DROP POLICY IF EXISTS "Tenant admins can manage tenant option legs" ON quotation_version_option_legs;
DROP POLICY IF EXISTS "Users can create franchise option legs" ON quotation_version_option_legs;
DROP POLICY IF EXISTS "Users can view franchise option legs" ON quotation_version_option_legs;

DROP POLICY IF EXISTS "Platform admins can manage all quote charges" ON quote_charges;
DROP POLICY IF EXISTS "Tenant admins can manage tenant quote charges" ON quote_charges;
DROP POLICY IF EXISTS "Users can create franchise quote charges" ON quote_charges;
DROP POLICY IF EXISTS "Users can view franchise quote charges" ON quote_charges;
DROP POLICY IF EXISTS "quote_charges_manage" ON quote_charges;
DROP POLICY IF EXISTS "quote_charges_read" ON quote_charges;

-- Step 5: Create simplified RLS policies (allowing NULL for legacy data)

-- Quotation Versions
CREATE POLICY "Platform admins full access to quotation versions"
ON quotation_versions FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins manage tenant quotation versions"
ON quotation_versions FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'tenant_admin'::app_role) 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Franchise admins manage franchise quotation versions"
ON quotation_versions FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'franchise_admin'::app_role) 
  AND (franchise_id = get_user_franchise_id(auth.uid()) OR franchise_id IS NULL)
);

CREATE POLICY "Users view franchise quotation versions"
ON quotation_versions FOR SELECT
TO authenticated
USING (franchise_id = get_user_franchise_id(auth.uid()) OR franchise_id IS NULL);

CREATE POLICY "Users create franchise quotation versions"
ON quotation_versions FOR INSERT
TO authenticated
WITH CHECK (franchise_id = get_user_franchise_id(auth.uid()));

-- Quotation Version Options
CREATE POLICY "Platform admins full access to quotation options"
ON quotation_version_options FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins manage tenant quotation options"
ON quotation_version_options FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'tenant_admin'::app_role) 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Franchise admins manage franchise quotation options"
ON quotation_version_options FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'franchise_admin'::app_role) 
  AND (franchise_id = get_user_franchise_id(auth.uid()) OR franchise_id IS NULL)
);

CREATE POLICY "Users view franchise quotation options"
ON quotation_version_options FOR SELECT
TO authenticated
USING (franchise_id = get_user_franchise_id(auth.uid()) OR franchise_id IS NULL);

CREATE POLICY "Users create franchise quotation options"
ON quotation_version_options FOR INSERT
TO authenticated
WITH CHECK (franchise_id = get_user_franchise_id(auth.uid()));

-- Quotation Version Option Legs
CREATE POLICY "Platform admins full access to option legs"
ON quotation_version_option_legs FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins manage tenant option legs"
ON quotation_version_option_legs FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'tenant_admin'::app_role) 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Franchise admins manage franchise option legs"
ON quotation_version_option_legs FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'franchise_admin'::app_role) 
  AND (franchise_id = get_user_franchise_id(auth.uid()) OR franchise_id IS NULL)
);

CREATE POLICY "Users view franchise option legs"
ON quotation_version_option_legs FOR SELECT
TO authenticated
USING (franchise_id = get_user_franchise_id(auth.uid()) OR franchise_id IS NULL);

CREATE POLICY "Users create franchise option legs"
ON quotation_version_option_legs FOR INSERT
TO authenticated
WITH CHECK (franchise_id = get_user_franchise_id(auth.uid()));

-- Quote Charges
CREATE POLICY "Platform admins full access to quote charges"
ON quote_charges FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins manage tenant quote charges"
ON quote_charges FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'tenant_admin'::app_role) 
  AND tenant_id = get_user_tenant_id(auth.uid())
);

CREATE POLICY "Franchise admins manage franchise quote charges"
ON quote_charges FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'franchise_admin'::app_role) 
  AND (franchise_id = get_user_franchise_id(auth.uid()) OR franchise_id IS NULL)
);

CREATE POLICY "Users view franchise quote charges"
ON quote_charges FOR SELECT
TO authenticated
USING (franchise_id = get_user_franchise_id(auth.uid()) OR franchise_id IS NULL);

CREATE POLICY "Users create franchise quote charges"
ON quote_charges FOR INSERT
TO authenticated
WITH CHECK (franchise_id = get_user_franchise_id(auth.uid()));