-- Create quote_audits table
CREATE TABLE IF NOT EXISTS quote_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'create', 'update', 'override_number'
  old_value jsonb,
  new_value jsonb,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now(),
  notes text
);

-- Enable RLS
ALTER TABLE quote_audits ENABLE ROW LEVEL SECURITY;

-- Policies for quote_audits
CREATE POLICY "Users can view audits for their tenant" ON quote_audits
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_audits.quote_id
      AND q.tenant_id = (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1)
    )
  );

-- Function to generate quote number
CREATE OR REPLACE FUNCTION generate_quote_number(p_prefix text, p_date date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_date_str text;
  v_pattern text;
  v_last_number text;
  v_sequence int;
  v_new_number text;
BEGIN
  -- Format date as YYYYMMDD
  v_date_str := to_char(p_date, 'YYYYMMDD');
  v_pattern := p_prefix || '-' || v_date_str || '-%';

  -- Find the last number matching this pattern
  -- Note: This is prone to race conditions under high concurrency without locking
  -- For higher robustness, we could use advisory locks or a separate sequence table
  SELECT quote_number INTO v_last_number
  FROM quotes
  WHERE quote_number LIKE v_pattern
  ORDER BY quote_number DESC
  LIMIT 1;

  IF v_last_number IS NULL THEN
    v_sequence := 1;
  ELSE
    -- Extract the sequence part (last 3 digits)
    -- Assuming format PREFIX-YYYYMMDD-NNN
    BEGIN
      v_sequence := to_number(split_part(v_last_number, '-', 3), '999') + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Fallback if parsing fails (e.g. custom format)
      v_sequence := 1;
    END;
  END IF;

  -- Format new number with padding
  v_new_number := p_prefix || '-' || v_date_str || '-' || lpad(v_sequence::text, 3, '0');

  RETURN v_new_number;
END;
$$;

-- Function to check availability
CREATE OR REPLACE FUNCTION check_quote_number_availability(p_quote_number text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM quotes WHERE quote_number = p_quote_number
  );
END;
$$;

-- Trigger function for audit
CREATE OR REPLACE FUNCTION audit_quote_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO quote_audits (quote_id, action, new_value, changed_by)
    VALUES (NEW.id, 'create', row_to_json(NEW), auth.uid());
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (NEW.quote_number IS DISTINCT FROM OLD.quote_number) THEN
       INSERT INTO quote_audits (quote_id, action, old_value, new_value, changed_by, notes)
       VALUES (NEW.id, 'override_number', row_to_json(OLD), row_to_json(NEW), auth.uid(), 'Quote number changed from ' || COALESCE(OLD.quote_number, 'null') || ' to ' || NEW.quote_number);
    ELSE
       -- Only log significant updates if needed, for now log all updates
       INSERT INTO quote_audits (quote_id, action, old_value, new_value, changed_by)
       VALUES (NEW.id, 'update', row_to_json(OLD), row_to_json(NEW), auth.uid());
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

-- Create Trigger
DROP TRIGGER IF EXISTS trigger_audit_quotes ON quotes;
CREATE TRIGGER trigger_audit_quotes
AFTER INSERT OR UPDATE ON quotes
FOR EACH ROW EXECUTE FUNCTION audit_quote_changes();
