-- Add option_name column to quotation_version_options
ALTER TABLE public.quotation_version_options 
ADD COLUMN option_name TEXT;

-- Add a comment explaining the column
COMMENT ON COLUMN public.quotation_version_options.option_name IS 'Human-readable name for the option (e.g., Option A, Option B)';

-- Create function to generate next option name for a version
CREATE OR REPLACE FUNCTION generate_next_option_name(p_version_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
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