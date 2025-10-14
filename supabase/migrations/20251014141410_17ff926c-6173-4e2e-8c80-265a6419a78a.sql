-- Drop the existing check constraint first
ALTER TABLE public.carriers DROP CONSTRAINT IF EXISTS carriers_carrier_type_check;

-- Now update all carriers to new types without constraint blocking
UPDATE public.carriers 
SET carrier_type = 'air_cargo'
WHERE carrier_type = 'air';

UPDATE public.carriers 
SET carrier_type = 'courier' 
WHERE carrier_name IN ('UPS', 'FedEx')
AND carrier_name NOT IN ('FedEx Express', 'UPS Airlines');

UPDATE public.carriers 
SET carrier_type = 'movers_and_packers' 
WHERE carrier_name IN (
  'Allied Van Lines',
  'North American Van Lines',
  'Atlas Van Lines',
  'United Van Lines',
  'Mayflower Transit'
);

-- Add new check constraint AFTER all updates are done
ALTER TABLE public.carriers 
ADD CONSTRAINT carriers_carrier_type_check 
CHECK (carrier_type IN ('ocean', 'air_cargo', 'trucking', 'courier', 'movers_and_packers', 'rail'));