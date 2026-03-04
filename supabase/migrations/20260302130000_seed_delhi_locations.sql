
-- Insert 'Delhi' and a few other major locations if they don't exist
-- Using WHERE NOT EXISTS to avoid constraint errors if location_code is not unique
-- Adjusted location_type to match check constraint: seaport, airport, inland_port, warehouse, terminal, railway_terminal

INSERT INTO public.ports_locations (
    id, location_name, location_code, location_type, country, city, created_at, updated_at
)
SELECT gen_random_uuid(), 'Delhi (ICD)', 'DEL', 'inland_port', 'India', 'New Delhi', now(), now()
WHERE NOT EXISTS (
    SELECT 1 FROM public.ports_locations WHERE location_name = 'Delhi (ICD)'
);

INSERT INTO public.ports_locations (
    id, location_name, location_code, location_type, country, city, created_at, updated_at
)
SELECT gen_random_uuid(), 'Indira Gandhi International Airport', 'DEL', 'airport', 'India', 'New Delhi', now(), now()
WHERE NOT EXISTS (
    SELECT 1 FROM public.ports_locations WHERE location_name = 'Indira Gandhi International Airport'
);

INSERT INTO public.ports_locations (
    id, location_name, location_code, location_type, country, city, created_at, updated_at
)
SELECT gen_random_uuid(), 'Nhava Sheva', 'INNSA', 'seaport', 'India', 'Mumbai', now(), now()
WHERE NOT EXISTS (
    SELECT 1 FROM public.ports_locations WHERE location_name = 'Nhava Sheva'
);

INSERT INTO public.ports_locations (
    id, location_name, location_code, location_type, country, city, created_at, updated_at
)
SELECT gen_random_uuid(), 'Mundra', 'INMUN', 'seaport', 'India', 'Mundra', now(), now()
WHERE NOT EXISTS (
    SELECT 1 FROM public.ports_locations WHERE location_name = 'Mundra'
);
