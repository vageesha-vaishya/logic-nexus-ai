-- Modify container tables to support global entries and seed data

-- Modify container_types to allow NULL tenant_id for global entries
ALTER TABLE public.container_types 
ALTER COLUMN tenant_id DROP NOT NULL;

-- Modify container_sizes to allow NULL tenant_id for global entries
ALTER TABLE public.container_sizes 
ALTER COLUMN tenant_id DROP NOT NULL;

-- Add unique constraints for code columns if they do not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'container_types_code_key'
      AND conrelid = 'public.container_types'::regclass
  ) THEN
    ALTER TABLE public.container_types 
    ADD CONSTRAINT container_types_code_key UNIQUE (code);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'container_sizes_code_key'
      AND conrelid = 'public.container_sizes'::regclass
  ) THEN
    ALTER TABLE public.container_sizes 
    ADD CONSTRAINT container_sizes_code_key UNIQUE (code);
  END IF;
END $$;

-- Update RLS policies for container_types to include global entries
DROP POLICY IF EXISTS "Tenant users can view container types" ON public.container_types;
CREATE POLICY "Tenant users can view container types"
ON public.container_types
FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR tenant_id IS NULL);

-- Update RLS policies for container_sizes to include global entries
DROP POLICY IF EXISTS "Tenant users can view container sizes" ON public.container_sizes;
CREATE POLICY "Tenant users can view container sizes"
ON public.container_sizes
FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR tenant_id IS NULL);

-- Seed global container types
INSERT INTO public.container_types (tenant_id, name, code, is_active)
VALUES
  (NULL, 'Standard Dry', 'dry', true),
  (NULL, 'High Cube', 'hc', true),
  (NULL, 'Reefer (Refrigerated)', 'reefer', true),
  (NULL, 'Open Top', 'open_top', true),
  (NULL, 'Flat Rack', 'flat_rack', true),
  (NULL, 'ISO Tank', 'iso_tank', true)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      is_active = EXCLUDED.is_active;

-- Seed global container sizes
INSERT INTO public.container_sizes (tenant_id, name, code, description, is_active)
VALUES
  (NULL, '20'' Standard', '20_std', '20-foot standard dry container', true),
  (NULL, '40'' Standard', '40_std', '40-foot standard dry container', true),
  (NULL, '40'' High Cube', '40_hc', '40-foot high cube dry container', true),
  (NULL, '45'' High Cube', '45_hc', '45-foot high cube dry container', true),
  (NULL, '20'' Reefer', '20_reefer', '20-foot refrigerated container', true),
  (NULL, '40'' Reefer', '40_reefer', '40-foot refrigerated container', true)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      is_active = EXCLUDED.is_active;
