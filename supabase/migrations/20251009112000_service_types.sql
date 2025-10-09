-- Create service_types table for managing allowed service type values
SET search_path = public;

CREATE TABLE IF NOT EXISTS public.service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_types_active ON public.service_types(is_active);
CREATE INDEX IF NOT EXISTS idx_service_types_name ON public.service_types(name);

-- Enable RLS
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Platform admins can manage all service types" ON public.service_types;
CREATE POLICY "Platform admins can manage all service types"
ON public.service_types
FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "All authenticated users can view service types" ON public.service_types;
CREATE POLICY "All authenticated users can view service types"
ON public.service_types
FOR SELECT
TO authenticated
USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_service_types_updated_at ON public.service_types;
CREATE TRIGGER update_service_types_updated_at
BEFORE UPDATE ON public.service_types
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Seed common service types
INSERT INTO public.service_types (name, description)
VALUES
  ('ocean', 'Ocean freight'),
  ('air', 'Air freight'),
  ('trucking', 'Road transport'),
  ('courier', 'Courier/parcel delivery'),
  ('moving', 'Relocation services'),
  ('railway_transport', 'Rail transport')
ON CONFLICT (name) DO NOTHING;