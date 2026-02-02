-- Enhance vendors table to support comprehensive logistics types and attributes

-- 1. Update Vendor Type Constraint
ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_type_check;

ALTER TABLE public.vendors ADD CONSTRAINT vendors_type_check 
CHECK (type IN (
  'carrier', 
  'agent', 
  'broker', 
  'warehouse', 
  'technology', 
  'manufacturing', 
  'retail', 
  '3pl', 
  'freight_forwarder', 
  'courier', 
  'ocean_carrier', 
  'air_carrier', 
  'trucker', 
  'rail_carrier', 
  'customs_broker', 
  'wholesaler', 
  'consulting', 
  'other'
));

-- 2. Add JSONB columns for flexible logistics data
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS operational_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS performance_metrics JSONB DEFAULT '{}'::jsonb;

-- 3. Create Indexes for JSONB querying
CREATE INDEX IF NOT EXISTS idx_vendors_operational_data ON public.vendors USING GIN (operational_data);
CREATE INDEX IF NOT EXISTS idx_vendors_performance_metrics ON public.vendors USING GIN (performance_metrics);

-- 4. Comment on columns
COMMENT ON COLUMN public.vendors.operational_data IS 'Flexible storage for logistics capabilities (fleet size, routes, vessel count, etc.)';
COMMENT ON COLUMN public.vendors.performance_metrics IS 'Tracked performance stats (on-time delivery, claims ratio, etc.)';
