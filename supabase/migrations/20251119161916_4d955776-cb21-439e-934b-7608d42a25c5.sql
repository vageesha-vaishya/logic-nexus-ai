-- Create transport_modes table
CREATE TABLE IF NOT EXISTS public.transport_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon_name TEXT NOT NULL,
  color TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 1000,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.transport_modes ENABLE ROW LEVEL SECURITY;

-- Everyone can view active transport modes
CREATE POLICY "Anyone can view active transport modes"
  ON public.transport_modes
  FOR SELECT
  USING (is_active = true);

-- Platform admins can manage transport modes
CREATE POLICY "Platform admins can manage transport modes"
  ON public.transport_modes
  FOR ALL
  USING (is_platform_admin(auth.uid()));

-- Add mode_id to service_types
ALTER TABLE public.service_types
ADD COLUMN IF NOT EXISTS mode_id UUID REFERENCES public.transport_modes(id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_service_types_mode_id ON public.service_types(mode_id);

-- Insert initial transport modes based on current hardcoded values
INSERT INTO public.transport_modes (code, name, icon_name, color, display_order) VALUES
  ('ocean', 'Ocean Freight', 'Ship', 'hsl(var(--chart-1))', 100),
  ('air', 'Air Freight', 'Plane', 'hsl(var(--chart-2))', 200),
  ('road', 'Road Transport', 'Truck', 'hsl(var(--chart-3))', 300),
  ('rail', 'Rail Transport', 'Train', 'hsl(var(--chart-4))', 400)
ON CONFLICT (code) DO NOTHING;

-- Update existing service_types to link to transport modes
UPDATE public.service_types
SET mode_id = (SELECT id FROM public.transport_modes WHERE code = 'ocean')
WHERE code IN ('ocean_freight', 'ocean_breakbulk', 'ocean_lcl', 'ocean_roro')
AND mode_id IS NULL;

UPDATE public.service_types
SET mode_id = (SELECT id FROM public.transport_modes WHERE code = 'air')
WHERE code = 'air_freight'
AND mode_id IS NULL;

UPDATE public.service_types
SET mode_id = (SELECT id FROM public.transport_modes WHERE code = 'road')
WHERE code IN ('road_freight', 'trucking')
AND mode_id IS NULL;

UPDATE public.service_types
SET mode_id = (SELECT id FROM public.transport_modes WHERE code = 'rail')
WHERE code = 'rail_freight'
AND mode_id IS NULL;

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_transport_modes_updated_at ON public.transport_modes;
CREATE TRIGGER update_transport_modes_updated_at
  BEFORE UPDATE ON public.transport_modes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();