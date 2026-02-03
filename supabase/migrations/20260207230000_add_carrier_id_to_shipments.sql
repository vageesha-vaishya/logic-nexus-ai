-- Add carrier_id column to shipments table
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS carrier_id UUID REFERENCES public.carriers(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_shipments_carrier_id ON public.shipments(carrier_id);

-- Update get_carrier_volume to use LEFT JOIN to include shipments even if carrier is missing? 
-- No, we want volume BY carrier, so inner join is appropriate. 
-- However, we might want to see "Unknown" carrier.
-- Let's update the RPC to be safe and clearer.

CREATE OR REPLACE FUNCTION public.get_carrier_volume(period text DEFAULT '12m')
RETURNS TABLE (
  carrier text,
  count bigint
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(c.carrier_name, 'Unknown') as carrier,
    count(s.id) as count
  FROM public.shipments s
  LEFT JOIN public.carriers c ON s.carrier_id = c.id
  WHERE s.created_at >= (now() - interval '1 year')
    AND s.tenant_id = public.get_user_tenant_id(auth.uid())
    AND s.carrier_id IS NOT NULL -- Only show actual carriers for now, or remove this to show Unknown
  GROUP BY c.carrier_name
  ORDER BY count DESC
  LIMIT 10;
END;
$$;
