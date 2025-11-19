-- ==========================================
-- PHASE 1: DATABASE RESTRUCTURING (FINAL)
-- Quotation Module Enhancement
-- ==========================================

-- Step 1: Create audit log table
CREATE TABLE IF NOT EXISTS quotation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  quotation_version_id UUID REFERENCES quotation_versions(id) ON DELETE CASCADE,
  quotation_version_option_id UUID REFERENCES quotation_version_options(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changes JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_quote_id ON quotation_audit_log(quote_id);
CREATE INDEX IF NOT EXISTS idx_audit_version_id ON quotation_audit_log(quotation_version_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON quotation_audit_log(created_at DESC);

-- Step 2: Fix orphaned charges - create default legs for options with charges but no legs
DO $$
DECLARE
  orphaned_charge RECORD;
  new_leg_id UUID;
BEGIN
  FOR orphaned_charge IN 
    SELECT DISTINCT qc.quote_option_id, qc.tenant_id
    FROM quote_charges qc
    WHERE qc.leg_id IS NULL
  LOOP
    INSERT INTO quotation_version_option_legs (
      id,
      tenant_id,
      quotation_version_option_id,
      sort_order,
      mode,
      origin_location,
      destination_location
    ) VALUES (
      gen_random_uuid(),
      orphaned_charge.tenant_id,
      orphaned_charge.quote_option_id,
      1,
      'ocean',
      'Origin',
      'Destination'
    )
    RETURNING id INTO new_leg_id;
    
    UPDATE quote_charges
    SET leg_id = new_leg_id
    WHERE quote_option_id = orphaned_charge.quote_option_id 
    AND leg_id IS NULL;
    
    RAISE NOTICE 'Created default leg % for option %', new_leg_id, orphaned_charge.quote_option_id;
  END LOOP;
END $$;

-- Step 3: Make leg_id NOT NULL in quote_charges
ALTER TABLE quote_charges 
  ALTER COLUMN leg_id SET NOT NULL;

-- Step 4: Add new fields to quotation_versions
ALTER TABLE quotation_versions
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add unique constraints for version identification
ALTER TABLE quotation_versions
  DROP CONSTRAINT IF EXISTS uq_quote_version_number,
  ADD CONSTRAINT uq_quote_version_number UNIQUE (quote_id, version_number);

ALTER TABLE quotation_versions
  DROP CONSTRAINT IF EXISTS uq_quote_major_minor,
  ADD CONSTRAINT uq_quote_major_minor UNIQUE (quote_id, major, minor);

CREATE INDEX IF NOT EXISTS idx_quotation_versions_current 
  ON quotation_versions(quote_id, is_current) WHERE is_current = true;

-- Step 5: Enhance quotation_version_options with calculated fields
ALTER TABLE quotation_version_options
  ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_buy NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sell NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leg_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charge_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_calculated_at TIMESTAMPTZ;

-- Step 6: Add current_version_id to quotes table
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS current_version_id UUID REFERENCES quotation_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_current_version 
  ON quotes(current_version_id) WHERE current_version_id IS NOT NULL;

-- Step 7: Set latest version as current for each quote
UPDATE quotes q
SET current_version_id = (
  SELECT qv.id 
  FROM quotation_versions qv 
  WHERE qv.quote_id = q.id 
  ORDER BY qv.version_number DESC 
  LIMIT 1
)
WHERE current_version_id IS NULL;

UPDATE quotation_versions qv
SET is_current = true
WHERE id IN (
  SELECT current_version_id 
  FROM quotes 
  WHERE current_version_id IS NOT NULL
);

-- Step 8: Create version management trigger
CREATE OR REPLACE FUNCTION validate_version_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE quotation_versions
    SET is_current = false
    WHERE quote_id = NEW.quote_id 
    AND id != NEW.id
    AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_current_version ON quotation_versions;
CREATE TRIGGER trg_validate_current_version
  BEFORE INSERT OR UPDATE OF is_current ON quotation_versions
  FOR EACH ROW
  EXECUTE FUNCTION validate_version_uniqueness();

-- Step 9: Create option totals calculation function
CREATE OR REPLACE FUNCTION calculate_option_totals(p_option_id UUID)
RETURNS TABLE(
  leg_count INTEGER,
  charge_count INTEGER,
  total_buy NUMERIC,
  total_sell NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT ql.id)::INTEGER as leg_count,
    COUNT(qc.id)::INTEGER as charge_count,
    COALESCE(SUM(CASE WHEN cs.code = 'BUY' THEN qc.amount ELSE 0 END), 0) as total_buy,
    COALESCE(SUM(CASE WHEN cs.code = 'SELL' THEN qc.amount ELSE 0 END), 0) as total_sell
  FROM quotation_version_options qvo
  LEFT JOIN quotation_version_option_legs ql ON ql.quotation_version_option_id = qvo.id
  LEFT JOIN quote_charges qc ON qc.leg_id = ql.id
  LEFT JOIN charge_sides cs ON cs.id = qc.charge_side_id
  WHERE qvo.id = p_option_id
  GROUP BY qvo.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 10: Create auto-calculation trigger
CREATE OR REPLACE FUNCTION update_option_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_option_id UUID;
  v_totals RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT quotation_version_option_id INTO v_option_id
    FROM quotation_version_option_legs
    WHERE id = OLD.leg_id;
  ELSE
    SELECT quotation_version_option_id INTO v_option_id
    FROM quotation_version_option_legs
    WHERE id = NEW.leg_id;
  END IF;
  
  SELECT * INTO v_totals FROM calculate_option_totals(v_option_id);
  
  UPDATE quotation_version_options
  SET 
    leg_count = v_totals.leg_count,
    charge_count = v_totals.charge_count,
    total_buy = v_totals.total_buy,
    total_sell = v_totals.total_sell,
    margin_amount = v_totals.total_sell - v_totals.total_buy,
    total_amount = v_totals.total_sell,
    last_calculated_at = now()
  WHERE id = v_option_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_update_option_totals_on_charge_change ON quote_charges;
CREATE TRIGGER trg_update_option_totals_on_charge_change
  AFTER INSERT OR UPDATE OR DELETE ON quote_charges
  FOR EACH ROW
  EXECUTE FUNCTION update_option_totals();

-- Step 11: Add leg sort validation
CREATE OR REPLACE FUNCTION validate_leg_sort_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sort_order = 1 OR NEW.sort_order IS NULL THEN
    SELECT COALESCE(MAX(sort_order), 0) + 100
    INTO NEW.sort_order
    FROM quotation_version_option_legs
    WHERE quotation_version_option_id = NEW.quotation_version_option_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_leg_sort_order ON quotation_version_option_legs;
CREATE TRIGGER trg_validate_leg_sort_order
  BEFORE INSERT ON quotation_version_option_legs
  FOR EACH ROW
  EXECUTE FUNCTION validate_leg_sort_order();

-- Step 12: Calculate totals for existing options
DO $$
DECLARE
  opt RECORD;
  totals RECORD;
BEGIN
  FOR opt IN SELECT id FROM quotation_version_options
  LOOP
    SELECT * INTO totals FROM calculate_option_totals(opt.id);
    
    UPDATE quotation_version_options
    SET 
      leg_count = totals.leg_count,
      charge_count = totals.charge_count,
      total_buy = totals.total_buy,
      total_sell = totals.total_sell,
      margin_amount = totals.total_sell - totals.total_buy,
      total_amount = totals.total_sell,
      last_calculated_at = now()
    WHERE id = opt.id;
  END LOOP;
END $$;

-- Step 13: Add RLS policies for audit log
ALTER TABLE quotation_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view franchise audit logs"
  ON quotation_audit_log FOR SELECT
  USING (
    quote_id IN (
      SELECT id FROM quotes 
      WHERE franchise_id = get_user_franchise_id(auth.uid())
    )
  );

CREATE POLICY "Tenant admins can view all audit logs"
  ON quotation_audit_log FOR SELECT
  USING (
    has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Platform admins can view all audit logs"
  ON quotation_audit_log FOR SELECT
  USING (is_platform_admin(auth.uid()));

-- Step 14: Add documentation
COMMENT ON TABLE quotation_audit_log IS 'Tracks all changes to quotes, versions, and options for audit trail';
COMMENT ON COLUMN quotation_versions.is_current IS 'Indicates if this is the current active version for the quote';
COMMENT ON COLUMN quotation_versions.locked_at IS 'When this version was locked (prevents further edits)';
COMMENT ON COLUMN quotation_version_options.locked IS 'Prevents further edits to this option';
COMMENT ON COLUMN quotation_version_options.total_buy IS 'Auto-calculated sum of all BUY side charges';
COMMENT ON COLUMN quotation_version_options.total_sell IS 'Auto-calculated sum of all SELL side charges';
COMMENT ON COLUMN quotes.current_version_id IS 'Reference to the currently active version';

DO $$
BEGIN
  RAISE NOTICE '✅ Phase 1 Complete - Database restructured successfully';
END $$;