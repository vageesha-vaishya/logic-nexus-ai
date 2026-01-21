-- Add detailed attributes to transport_modes for dynamic UI and validation
ALTER TABLE public.transport_modes 
ADD COLUMN IF NOT EXISTS validation_rules JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS supported_units JSONB DEFAULT '[]'::jsonb;

-- Seed update for existing modes
-- Air
UPDATE public.transport_modes 
SET 
  validation_rules = '{
    "origin_type": ["airport"],
    "destination_type": ["airport"],
    "weight_limit_kg": 100000,
    "required_fields": ["weight", "commodity"]
  }'::jsonb,
  supported_units = '["kg", "lbs"]'::jsonb
WHERE code = 'air';

-- Ocean
UPDATE public.transport_modes 
SET 
  validation_rules = '{
    "origin_type": ["seaport", "terminal", "inland_port"],
    "destination_type": ["seaport", "terminal", "inland_port"],
    "required_fields": ["volume", "container_type", "commodity"]
  }'::jsonb,
  supported_units = '["cbm", "teu", "feu"]'::jsonb
WHERE code = 'ocean';

-- Road
UPDATE public.transport_modes 
SET 
  validation_rules = '{
    "origin_type": ["city", "zip"],
    "destination_type": ["city", "zip"],
    "required_fields": ["weight", "commodity", "distance"]
  }'::jsonb,
  supported_units = '["kg", "lbs", "ton"]'::jsonb
WHERE code = 'road';

-- Rail
UPDATE public.transport_modes 
SET 
  validation_rules = '{
    "origin_type": ["rail_terminal"],
    "destination_type": ["rail_terminal"],
    "required_fields": ["weight", "container_type"]
  }'::jsonb,
  supported_units = '["container"]'::jsonb
WHERE code = 'rail';
