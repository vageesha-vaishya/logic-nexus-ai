-- Modify container tables to support global entries and seed data

-- Modify container_types to allow NULL tenant_id for global entries
ALTER TABLE public.container_types 
ALTER COLUMN tenant_id DROP NOT NULL;

-- Modify container_sizes to allow NULL tenant_id for global entries
ALTER TABLE public.container_sizes 
ALTER COLUMN tenant_id DROP NOT NULL;

-- Ensure legacy schemas have the columns referenced below
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'container_types'
      AND column_name = 'code'
  ) THEN
    ALTER TABLE public.container_types ADD COLUMN code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'container_types'
      AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.container_types ADD COLUMN is_active boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'container_sizes'
      AND column_name = 'code'
  ) THEN
    ALTER TABLE public.container_sizes ADD COLUMN code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'container_sizes'
      AND column_name = 'description'
  ) THEN
    ALTER TABLE public.container_sizes ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'container_sizes'
      AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.container_sizes ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

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
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'container_types'
      AND column_name = 'category'
  ) THEN
    EXECUTE $sql$
      INSERT INTO public.container_types (tenant_id, name, code, is_active, category)
      VALUES
        (NULL, 'Standard Dry', 'dry', true, 'Standard'),
        (NULL, 'High Cube', 'hc', true, 'Standard'),
        (NULL, 'Reefer (Refrigerated)', 'reefer', true, 'Reefer'),
        (NULL, 'Open Top', 'open_top', true, 'Open Top'),
        (NULL, 'Flat Rack', 'flat_rack', true, 'Flat Rack'),
        (NULL, 'ISO Tank', 'iso_tank', true, 'Tank')
      ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name,
            is_active = EXCLUDED.is_active,
            category = EXCLUDED.category;
    $sql$;
  ELSE
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
  END IF;
END $$;

-- Seed global container sizes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'container_sizes'
      AND column_name = 'name'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'container_sizes'
      AND column_name = 'code'
  ) THEN
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
  ELSE
    RAISE NOTICE 'Skipping container_sizes seed: legacy schema does not support (name, code).';
  END IF;
END $$;
