-- Add service_type_id column to services table
ALTER TABLE public.services 
ADD COLUMN service_type_id UUID REFERENCES public.service_types(id);

-- Migrate existing data: map service_type text to service_type_id
-- For now, we'll need to manually map or set to null since we don't have direct mapping
UPDATE public.services 
SET service_type_id = (
  SELECT id FROM public.service_types 
  WHERE LOWER(name) = LOWER(services.service_type) 
  LIMIT 1
);

-- Create index for better performance
CREATE INDEX idx_services_service_type_id ON public.services(service_type_id);

-- Add comment
COMMENT ON COLUMN public.services.service_type_id IS 'Foreign key reference to service_types table';