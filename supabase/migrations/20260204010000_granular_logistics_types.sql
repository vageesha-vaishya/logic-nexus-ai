BEGIN;

-- 1. Temporarily disable the constraint validation to fix existing data
ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_type_check;

-- 2. Update existing data to valid types to satisfy the new constraint
UPDATE public.vendors 
SET type = 'trucker' 
WHERE type = 'carrier';

UPDATE public.vendors 
SET type = 'broker' 
WHERE type NOT IN (
    'ocean_carrier', 'air_carrier', 'trucker', 'rail_carrier',
    'courier', 'freight_forwarder', '3pl', 'warehouse', 
    'customs_broker', 'agent', 'technology', 'manufacturing', 
    'retail', 'wholesaler', 'consulting', 'other'
);

-- 3. Apply the new constraint
ALTER TABLE public.vendors ADD CONSTRAINT vendors_type_check 
CHECK (type IN (
    'ocean_carrier', 'air_carrier', 'trucker', 'rail_carrier',
    'courier', 'freight_forwarder', '3pl', 'warehouse', 
    'customs_broker', 'agent', 'technology', 'manufacturing', 
    'retail', 'wholesaler', 'consulting', 'broker', 'other'
));

-- 4. Ensure operational_data and performance_metrics exist (idempotent)
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS operational_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS performance_metrics JSONB DEFAULT '{}'::jsonb;

-- 5. Update Indexes
CREATE INDEX IF NOT EXISTS idx_vendors_operational_data ON public.vendors USING gin (operational_data);

COMMIT;
