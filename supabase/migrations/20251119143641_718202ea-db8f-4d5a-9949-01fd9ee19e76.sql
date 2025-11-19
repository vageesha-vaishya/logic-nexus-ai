-- Phase 2: Backend Business Logic Implementation

-- =====================================================
-- 1. AUTOMATIC VERSION NUMBERING
-- =====================================================

-- Function to calculate next version number for a quote
CREATE OR REPLACE FUNCTION calculate_next_version_number(p_quote_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) INTO v_max_version
  FROM quotation_versions
  WHERE quote_id = p_quote_id;
  
  RETURN v_max_version + 1;
END;
$$;

-- Trigger to auto-assign version number
CREATE OR REPLACE FUNCTION auto_assign_version_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.version_number IS NULL THEN
    NEW.version_number := calculate_next_version_number(NEW.quote_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_assign_version_number ON quotation_versions;
CREATE TRIGGER trigger_auto_assign_version_number
  BEFORE INSERT ON quotation_versions
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_version_number();

-- =====================================================
-- 2. STATUS WORKFLOW VALIDATION
-- =====================================================

-- Function to validate status transitions
CREATE OR REPLACE FUNCTION validate_version_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status TEXT;
BEGIN
  -- Get old status if updating
  IF TG_OP = 'UPDATE' THEN
    v_old_status := OLD.status;
    
    -- Define allowed transitions
    -- draft -> sent, internal_review, cancelled
    -- sent -> accepted, rejected, expired, cancelled
    -- internal_review -> draft, sent, cancelled
    -- accepted -> fulfilled (future state)
    -- rejected, expired, cancelled are terminal states
    
    IF v_old_status = 'draft' AND NEW.status NOT IN ('draft', 'sent', 'internal_review', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid status transition from draft to %', NEW.status;
    ELSIF v_old_status = 'sent' AND NEW.status NOT IN ('sent', 'accepted', 'rejected', 'expired', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid status transition from sent to %', NEW.status;
    ELSIF v_old_status = 'internal_review' AND NEW.status NOT IN ('internal_review', 'draft', 'sent', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid status transition from internal_review to %', NEW.status;
    ELSIF v_old_status IN ('accepted', 'rejected', 'expired', 'cancelled') AND NEW.status != v_old_status THEN
      RAISE EXCEPTION 'Cannot change status from terminal state %', v_old_status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_version_status ON quotation_versions;
CREATE TRIGGER trigger_validate_version_status
  BEFORE INSERT OR UPDATE ON quotation_versions
  FOR EACH ROW
  EXECUTE FUNCTION validate_version_status_transition();

-- =====================================================
-- 3. MARGIN CALCULATIONS
-- =====================================================

-- Function to calculate option margins from charges
CREATE OR REPLACE FUNCTION calculate_option_margins(p_option_id UUID)
RETURNS TABLE(
  total_buy NUMERIC,
  total_sell NUMERIC,
  margin_amount NUMERIC,
  margin_percentage NUMERIC,
  charge_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_buy NUMERIC := 0;
  v_total_sell NUMERIC := 0;
  v_margin_amount NUMERIC := 0;
  v_margin_percentage NUMERIC := 0;
  v_charge_count INTEGER := 0;
BEGIN
  -- Calculate totals from charges
  SELECT 
    COALESCE(SUM(CASE WHEN cs.code = 'BUY' THEN qc.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cs.code = 'SELL' THEN qc.amount ELSE 0 END), 0),
    COUNT(*)
  INTO v_total_buy, v_total_sell, v_charge_count
  FROM quote_charges qc
  JOIN quotation_version_option_legs qvol ON qvol.id = qc.leg_id
  JOIN charge_sides cs ON cs.id = qc.charge_side_id
  WHERE qvol.quotation_version_option_id = p_option_id;
  
  -- Calculate margin
  v_margin_amount := v_total_sell - v_total_buy;
  
  -- Calculate margin percentage (avoid division by zero)
  IF v_total_buy > 0 THEN
    v_margin_percentage := (v_margin_amount / v_total_buy) * 100;
  ELSIF v_total_sell > 0 THEN
    v_margin_percentage := 100; -- 100% margin if no cost
  ELSE
    v_margin_percentage := 0;
  END IF;
  
  RETURN QUERY SELECT v_total_buy, v_total_sell, v_margin_amount, v_margin_percentage, v_charge_count;
END;
$$;

-- Trigger to auto-update option totals when charges change
CREATE OR REPLACE FUNCTION update_option_margins_on_charge_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_option_id UUID;
  v_margins RECORD;
BEGIN
  -- Get the option_id
  IF TG_OP = 'DELETE' THEN
    SELECT quotation_version_option_id INTO v_option_id
    FROM quotation_version_option_legs
    WHERE id = OLD.leg_id;
  ELSE
    SELECT quotation_version_option_id INTO v_option_id
    FROM quotation_version_option_legs
    WHERE id = NEW.leg_id;
  END IF;
  
  -- Calculate margins
  SELECT * INTO v_margins FROM calculate_option_margins(v_option_id);
  
  -- Update the option
  UPDATE quotation_version_options
  SET 
    total_buy = v_margins.total_buy,
    total_sell = v_margins.total_sell,
    total_amount = v_margins.total_sell,
    margin_amount = v_margins.margin_amount,
    margin_percentage = v_margins.margin_percentage,
    charge_count = v_margins.charge_count,
    last_calculated_at = NOW(),
    updated_at = NOW()
  WHERE id = v_option_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_option_margins ON quote_charges;
CREATE TRIGGER trigger_update_option_margins
  AFTER INSERT OR UPDATE OR DELETE ON quote_charges
  FOR EACH ROW
  EXECUTE FUNCTION update_option_margins_on_charge_change();

-- =====================================================
-- 4. CUSTOMER SELECTION VALIDATION
-- =====================================================

-- Function to validate only one selection per version
CREATE OR REPLACE FUNCTION validate_single_selection_per_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_count INTEGER;
BEGIN
  -- Check if there's already a selection for this version
  SELECT COUNT(*) INTO v_existing_count
  FROM customer_selections
  WHERE quotation_version_id = NEW.quotation_version_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
  
  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'A customer selection already exists for this quotation version';
  END IF;
  
  -- Validate that the option belongs to the version
  IF NOT EXISTS (
    SELECT 1 FROM quotation_version_options
    WHERE id = NEW.quotation_version_option_id
      AND quotation_version_id = NEW.quotation_version_id
  ) THEN
    RAISE EXCEPTION 'The selected option does not belong to this quotation version';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_customer_selection ON customer_selections;
CREATE TRIGGER trigger_validate_customer_selection
  BEFORE INSERT OR UPDATE ON customer_selections
  FOR EACH ROW
  EXECUTE FUNCTION validate_single_selection_per_version();

-- =====================================================
-- 5. AUTOMATIC AUDIT LOGGING
-- =====================================================

-- Function to log version changes
CREATE OR REPLACE FUNCTION log_version_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_changes JSONB;
BEGIN
  v_action := TG_OP;
  
  IF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    );
  ELSIF TG_OP = 'INSERT' THEN
    v_changes := row_to_json(NEW)::JSONB;
  ELSIF TG_OP = 'DELETE' THEN
    v_changes := row_to_json(OLD)::JSONB;
  END IF;
  
  INSERT INTO quotation_audit_log (
    tenant_id,
    quote_id,
    quotation_version_id,
    entity_type,
    entity_id,
    action,
    changes,
    user_id
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    COALESCE(NEW.quote_id, OLD.quote_id),
    COALESCE(NEW.id, OLD.id),
    'quotation_version',
    COALESCE(NEW.id, OLD.id),
    v_action,
    v_changes,
    auth.uid()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_version_changes ON quotation_versions;
CREATE TRIGGER trigger_log_version_changes
  AFTER INSERT OR UPDATE OR DELETE ON quotation_versions
  FOR EACH ROW
  EXECUTE FUNCTION log_version_changes();

-- Function to log option changes
CREATE OR REPLACE FUNCTION log_option_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_changes JSONB;
BEGIN
  v_action := TG_OP;
  
  IF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    );
  ELSIF TG_OP = 'INSERT' THEN
    v_changes := row_to_json(NEW)::JSONB;
  ELSIF TG_OP = 'DELETE' THEN
    v_changes := row_to_json(OLD)::JSONB;
  END IF;
  
  INSERT INTO quotation_audit_log (
    tenant_id,
    quotation_version_id,
    quotation_version_option_id,
    entity_type,
    entity_id,
    action,
    changes,
    user_id
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    COALESCE(NEW.quotation_version_id, OLD.quotation_version_id),
    COALESCE(NEW.id, OLD.id),
    'quotation_version_option',
    COALESCE(NEW.id, OLD.id),
    v_action,
    v_changes,
    auth.uid()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_option_changes ON quotation_version_options;
CREATE TRIGGER trigger_log_option_changes
  AFTER INSERT OR UPDATE OR DELETE ON quotation_version_options
  FOR EACH ROW
  EXECUTE FUNCTION log_option_changes();

-- =====================================================
-- 6. HELPER FUNCTIONS FOR BUSINESS LOGIC
-- =====================================================

-- Function to mark version as current and unmark others
CREATE OR REPLACE FUNCTION set_current_version(p_version_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote_id UUID;
BEGIN
  -- Get the quote_id
  SELECT quote_id INTO v_quote_id
  FROM quotation_versions
  WHERE id = p_version_id;
  
  -- Unmark all other versions
  UPDATE quotation_versions
  SET is_current = FALSE
  WHERE quote_id = v_quote_id AND id != p_version_id;
  
  -- Mark this version as current
  UPDATE quotation_versions
  SET is_current = TRUE
  WHERE id = p_version_id;
  
  -- Update the quote's current_version_id
  UPDATE quotes
  SET current_version_id = p_version_id
  WHERE id = v_quote_id;
END;
$$;

-- Function to compare two versions
CREATE OR REPLACE FUNCTION compare_versions(p_version_id_1 UUID, p_version_id_2 UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comparison JSONB;
  v_version_1 RECORD;
  v_version_2 RECORD;
BEGIN
  -- Get version details
  SELECT * INTO v_version_1 FROM quotation_versions WHERE id = p_version_id_1;
  SELECT * INTO v_version_2 FROM quotation_versions WHERE id = p_version_id_2;
  
  v_comparison := jsonb_build_object(
    'version_1', row_to_json(v_version_1),
    'version_2', row_to_json(v_version_2),
    'differences', jsonb_build_object(
      'status_changed', v_version_1.status != v_version_2.status,
      'created_at_diff', EXTRACT(EPOCH FROM (v_version_2.created_at - v_version_1.created_at))
    )
  );
  
  RETURN v_comparison;
END;
$$;

COMMENT ON FUNCTION calculate_next_version_number IS 'Calculates the next version number for a quote';
COMMENT ON FUNCTION auto_assign_version_number IS 'Automatically assigns version numbers to new quotation versions';
COMMENT ON FUNCTION validate_version_status_transition IS 'Enforces valid status transitions for quotation versions';
COMMENT ON FUNCTION calculate_option_margins IS 'Calculates buy/sell totals and margins for a quotation option';
COMMENT ON FUNCTION update_option_margins_on_charge_change IS 'Auto-updates option margins when charges are modified';
COMMENT ON FUNCTION validate_single_selection_per_version IS 'Ensures only one customer selection per version';
COMMENT ON FUNCTION log_version_changes IS 'Logs all changes to quotation versions for audit trail';
COMMENT ON FUNCTION log_option_changes IS 'Logs all changes to quotation options for audit trail';
COMMENT ON FUNCTION set_current_version IS 'Marks a version as current and updates the parent quote';
COMMENT ON FUNCTION compare_versions IS 'Compares two versions and returns differences';