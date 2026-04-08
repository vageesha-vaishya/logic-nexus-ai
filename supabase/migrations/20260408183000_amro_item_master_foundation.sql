BEGIN;

CREATE TABLE IF NOT EXISTS public.amro_item_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  part_number text NOT NULL,
  description text,
  item_type text NOT NULL DEFAULT 'part' CHECK (item_type IN ('part', 'tool', 'consumable', 'kit')),
  category text,
  subcategory text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated', 'retired')),
  lifecycle_status text NOT NULL DEFAULT 'serviceable' CHECK (lifecycle_status IN (
    'serviceable',
    'inspection_due',
    'needs_repair',
    'repair_in_progress',
    'ready_for_install',
    'replaced',
    'retired',
    'quarantined'
  )),
  specification jsonb NOT NULL DEFAULT '{}'::jsonb,
  manufacturer_name text,
  manufacturer_part_number text,
  oem_part_number text,
  unit_of_measure text NOT NULL DEFAULT 'EA',
  base_unit_of_measure text NOT NULL DEFAULT 'EA',
  uom_conversion_factor numeric(18,6) NOT NULL DEFAULT 1.0 CHECK (uom_conversion_factor > 0),
  currency text NOT NULL DEFAULT 'USD',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, part_number)
);

CREATE INDEX IF NOT EXISTS idx_amro_item_master_tenant_updated
  ON public.amro_item_master (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_amro_item_master_tenant_category
  ON public.amro_item_master (tenant_id, category, subcategory);

CREATE INDEX IF NOT EXISTS idx_amro_item_master_tenant_item_type
  ON public.amro_item_master (tenant_id, item_type, is_active);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'amro_item_master_part_number_format_ck'
      AND conrelid = 'public.amro_item_master'::regclass
  ) THEN
    ALTER TABLE public.amro_item_master
      ADD CONSTRAINT amro_item_master_part_number_format_ck
      CHECK (part_number ~ '^[A-Z0-9-]{3,64}$');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.amro_item_cross_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  item_master_id uuid NOT NULL REFERENCES public.amro_item_master(id) ON DELETE CASCADE,
  reference_type text NOT NULL CHECK (reference_type IN ('alternate', 'superseded_by', 'supersedes', 'vendor', 'oem')),
  reference_part_number text NOT NULL,
  reference_description text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amro_item_cross_refs_tenant_item
  ON public.amro_item_cross_references (tenant_id, item_master_id, reference_type);

CREATE TABLE IF NOT EXISTS public.amro_item_uom_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  item_master_id uuid NOT NULL REFERENCES public.amro_item_master(id) ON DELETE CASCADE,
  from_uom text NOT NULL,
  to_uom text NOT NULL,
  factor numeric(18,6) NOT NULL CHECK (factor > 0),
  rounding_mode text NOT NULL DEFAULT 'half_up' CHECK (rounding_mode IN ('half_up', 'up', 'down')),
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, item_master_id, from_uom, to_uom)
);

CREATE INDEX IF NOT EXISTS idx_amro_item_uom_conv_tenant_item
  ON public.amro_item_uom_conversions (tenant_id, item_master_id, is_active);

COMMIT;
