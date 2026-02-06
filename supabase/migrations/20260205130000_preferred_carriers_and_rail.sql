-- Create the vendor_preferred_carriers table
CREATE TABLE IF NOT EXISTS public.vendor_preferred_carriers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES public.vendors(id) NOT NULL,
  carrier_id UUID REFERENCES public.carriers(id) NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('ocean', 'air', 'road', 'rail')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(vendor_id, carrier_id, mode)
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_vendor_preferred_carriers_updated_at ON public.vendor_preferred_carriers;
CREATE TRIGGER update_vendor_preferred_carriers_updated_at
BEFORE UPDATE ON public.vendor_preferred_carriers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.vendor_preferred_carriers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view preferred carriers" ON public.vendor_preferred_carriers;
CREATE POLICY "Authenticated users can view preferred carriers"
  ON public.vendor_preferred_carriers FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage preferred carriers" ON public.vendor_preferred_carriers;
CREATE POLICY "Authenticated users can manage preferred carriers"
  ON public.vendor_preferred_carriers FOR ALL
  USING (auth.role() = 'authenticated');

-- Ensure 'rail' exists in transport_modes if it's a table
INSERT INTO public.transport_modes (code, name, description, is_active)
VALUES ('rail', 'Rail Freight', 'Rail transport services', true)
ON CONFLICT (code) DO NOTHING;

-- Create RPC to get preferred carriers
CREATE OR REPLACE FUNCTION get_vendor_preferred_carriers(p_vendor_id UUID, p_mode TEXT DEFAULT NULL)
RETURNS TABLE (
  carrier_id UUID,
  carrier_name TEXT,
  scac TEXT,
  iata TEXT,
  mode TEXT,
  is_preferred BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.carrier_name,
    c.scac,
    c.iata,
    vpc.mode,
    true as is_preferred
  FROM 
    public.vendor_preferred_carriers vpc
  JOIN 
    public.carriers c ON c.id = vpc.carrier_id
  WHERE 
    vpc.vendor_id = p_vendor_id
    AND (p_mode IS NULL OR vpc.mode = p_mode)
    AND vpc.is_active = true;
END;
$$ LANGUAGE plpgsql;
