-- Fix search_path for generate_next_option_name function
CREATE OR REPLACE FUNCTION generate_next_option_name(p_version_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_next_letter CHAR(1);
BEGIN
  -- Count existing options for this version
  SELECT COUNT(*) INTO v_count
  FROM quotation_version_options
  WHERE quotation_version_id = p_version_id;
  
  -- Generate letter: A=65 in ASCII, so A is 0, B is 1, etc.
  v_next_letter := CHR(65 + v_count);
  
  RETURN 'Option ' || v_next_letter;
END;
$$;