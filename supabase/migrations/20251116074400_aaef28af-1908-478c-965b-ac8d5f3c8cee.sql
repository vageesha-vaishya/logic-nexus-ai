-- Seed Default Simple Theme
-- Create themes table if it doesn't exist and seed a default theme

CREATE TABLE IF NOT EXISTS public.themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  colors JSONB DEFAULT '{}',
  typography JSONB DEFAULT '{}',
  spacing JSONB DEFAULT '{}',
  borders JSONB DEFAULT '{}',
  shadows JSONB DEFAULT '{}',
  custom_css TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS on themes
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for themes
DROP POLICY IF EXISTS "Users can view themes in their tenant" ON public.themes;
CREATE POLICY "Users can view themes in their tenant" 
  ON public.themes FOR SELECT 
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles 
      WHERE user_id = auth.uid()
    )
    OR public.is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Tenant admins can manage themes" ON public.themes;
CREATE POLICY "Tenant admins can manage themes" 
  ON public.themes FOR ALL 
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('tenant_admin', 'platform_admin')
    )
    OR public.is_platform_admin(auth.uid())
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_themes_tenant_id ON public.themes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_themes_is_default ON public.themes(is_default);
CREATE INDEX IF NOT EXISTS idx_themes_is_active ON public.themes(is_active);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_themes_updated_at ON public.themes;
CREATE TRIGGER update_themes_updated_at 
  BEFORE UPDATE ON public.themes 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default simple theme for existing tenants
INSERT INTO public.themes (tenant_id, name, is_default, is_active, colors, typography, spacing, borders, shadows)
SELECT 
  t.id,
  'Simple Default',
  true,
  true,
  jsonb_build_object(
    'primary', '#3b82f6',
    'secondary', '#64748b',
    'success', '#10b981',
    'warning', '#f59e0b',
    'danger', '#ef4444',
    'background', '#ffffff',
    'foreground', '#0f172a',
    'muted', '#f1f5f9',
    'mutedForeground', '#64748b',
    'border', '#e2e8f0',
    'input', '#e2e8f0',
    'ring', '#3b82f6'
  ),
  jsonb_build_object(
    'fontFamily', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    'fontSize', '16px',
    'fontWeightNormal', '400',
    'fontWeightMedium', '500',
    'fontWeightBold', '700',
    'lineHeight', '1.5'
  ),
  jsonb_build_object(
    'xs', '0.25rem',
    'sm', '0.5rem',
    'md', '1rem',
    'lg', '1.5rem',
    'xl', '2rem',
    '2xl', '3rem'
  ),
  jsonb_build_object(
    'radius', '0.5rem',
    'radiusSm', '0.25rem',
    'radiusLg', '0.75rem',
    'width', '1px'
  ),
  jsonb_build_object(
    'sm', '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    'md', '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    'lg', '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    'xl', '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
  )
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.themes 
  WHERE tenant_id = t.id AND is_default = true
)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.themes IS 'Stores theme configurations for tenants';
COMMENT ON COLUMN public.themes.is_default IS 'Whether this is the default theme for the tenant';
COMMENT ON COLUMN public.themes.colors IS 'Color palette configuration';
COMMENT ON COLUMN public.themes.typography IS 'Typography settings';
COMMENT ON COLUMN public.themes.spacing IS 'Spacing scale';
COMMENT ON COLUMN public.themes.borders IS 'Border configurations';
COMMENT ON COLUMN public.themes.shadows IS 'Shadow configurations';
COMMENT ON COLUMN public.themes.custom_css IS 'Additional custom CSS';