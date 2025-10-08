-- Create trigger to auto-generate quote_number if not provided
CREATE OR REPLACE FUNCTION public.auto_generate_quote_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only generate if quote_number is not already set
  IF NEW.quote_number IS NULL THEN
    NEW.quote_number := public.generate_quote_number(NEW.tenant_id, NEW.franchise_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_generate_quote_number ON public.quotes;

-- Create trigger on quotes table
CREATE TRIGGER trigger_auto_generate_quote_number
  BEFORE INSERT ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_quote_number();