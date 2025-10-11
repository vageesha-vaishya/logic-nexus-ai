-- Ensure package_categories and package_sizes exist (idempotent)
BEGIN;

-- package_categories
CREATE TABLE IF NOT EXISTS public.package_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  category_name TEXT NOT NULL,
  category_code TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- package_sizes
CREATE TABLE IF NOT EXISTS public.package_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  size_name TEXT NOT NULL,
  size_code TEXT,
  length_ft NUMERIC,
  width_ft NUMERIC,
  height_ft NUMERIC,
  max_weight_kg NUMERIC,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- quote_items extensions (safe re-apply)
ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS package_category_id UUID,
  ADD COLUMN IF NOT EXISTS package_size_id UUID;

-- Enable RLS (safe, idempotent)
ALTER TABLE public.package_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_sizes ENABLE ROW LEVEL SECURITY;

-- updated_at triggers (recreate safely)
DROP TRIGGER IF EXISTS update_package_categories_updated_at ON public.package_categories;
CREATE TRIGGER update_package_categories_updated_at
  BEFORE UPDATE ON public.package_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_package_sizes_updated_at ON public.package_sizes;
CREATE TRIGGER update_package_sizes_updated_at
  BEFORE UPDATE ON public.package_sizes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;