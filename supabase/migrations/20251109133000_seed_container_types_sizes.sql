-- Seed global container types and sizes
-- These entries are tenant-agnostic (tenant_id NULL) and can be
-- referenced by all tenants due to RLS policies that allow NULL tenant_id.

BEGIN;

-- Container Types (global)
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

-- Container Sizes (global)
INSERT INTO public.container_sizes (tenant_id, name, code, description, is_active)
VALUES
  (NULL, '20\' Standard', '20_std', '20-foot standard dry container', true),
  (NULL, '40\' Standard', '40_std', '40-foot standard dry container', true),
  (NULL, '40\' High Cube', '40_hc', '40-foot high cube dry container', true),
  (NULL, '45\' High Cube', '45_hc', '45-foot high cube dry container', true),
  (NULL, '20\' Reefer', '20_reefer', '20-foot refrigerated container', true),
  (NULL, '40\' Reefer', '40_reefer', '40-foot refrigerated container', true)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      is_active = EXCLUDED.is_active;

COMMIT;