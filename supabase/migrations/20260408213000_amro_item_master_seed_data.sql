BEGIN;

CREATE TEMP TABLE IF NOT EXISTS tmp_amro_item_master_upserted (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  franchise_id uuid NULL,
  part_number text NOT NULL
) ON COMMIT DROP;

TRUNCATE tmp_amro_item_master_upserted;

WITH tenant_scope AS (
  SELECT
    t.id AS tenant_id,
    (
      SELECT f.id
      FROM public.franchises f
      WHERE f.tenant_id = t.id
      ORDER BY f.created_at NULLS LAST, f.id
      LIMIT 1
    ) AS franchise_id
  FROM public.tenants t
),
seed_rows AS (
  SELECT
    tenant_id,
    franchise_id,
    part_number,
    description,
    item_type,
    category,
    subcategory,
    status,
    lifecycle_status,
    specification,
    manufacturer_name,
    manufacturer_part_number,
    oem_part_number,
    unit_of_measure,
    base_unit_of_measure,
    uom_conversion_factor,
    currency,
    is_active,
    metadata
  FROM tenant_scope
  CROSS JOIN (
    VALUES
      (
        'AMRO-IM-0001',
        'Hydraulic pump assembly',
        'part',
        'hydraulics',
        'pump',
        'active',
        'serviceable',
        '{"rating":"3000psi","ata_chapter":"29"}'::jsonb,
        'AeroLink Components',
        'ALC-HP-3000',
        'OEM-HP-3000',
        'EA',
        'EA',
        1.0,
        'USD',
        true,
        '{"seed_source":"amro-item-master-seed","priority":"high"}'::jsonb
      ),
      (
        'AMRO-IM-0002',
        'Fuel filter cartridge',
        'consumable',
        'fuel_system',
        'filter',
        'active',
        'inspection_due',
        '{"micron":"10","ata_chapter":"28"}'::jsonb,
        'SkyBridge Industrial',
        'SBI-FF-010',
        'OEM-FF-010',
        'EA',
        'EA',
        1.0,
        'USD',
        true,
        '{"seed_source":"amro-item-master-seed","priority":"normal"}'::jsonb
      ),
      (
        'AMRO-IM-0003',
        'Landing gear torque wrench kit',
        'tool',
        'landing_gear',
        'torque_tool',
        'active',
        'ready_for_install',
        '{"range":"40-250Nm","ata_chapter":"32"}'::jsonb,
        'RotorPrime Tools',
        'RPT-TW-250',
        'OEM-TW-250',
        'EA',
        'EA',
        1.0,
        'USD',
        true,
        '{"seed_source":"amro-item-master-seed","calibration":"required"}'::jsonb
      ),
      (
        'AMRO-IM-0004',
        'Engine seal replacement kit',
        'kit',
        'engine',
        'seal_kit',
        'active',
        'serviceable',
        '{"kit_size":"12","ata_chapter":"71"}'::jsonb,
        'LineOps Vendor Hub',
        'LOV-SK-712',
        'OEM-SK-712',
        'KIT',
        'EA',
        12.0,
        'USD',
        true,
        '{"seed_source":"amro-item-master-seed","contains_consumables":true}'::jsonb
      ),
      (
        'AMRO-IM-0005',
        'Avionics control relay',
        'part',
        'avionics',
        'relay',
        'active',
        'quarantined',
        '{"voltage":"28V","ata_chapter":"24"}'::jsonb,
        'AOG Express',
        'AOG-RLY-24',
        'OEM-RLY-24',
        'EA',
        'EA',
        1.0,
        'USD',
        true,
        '{"seed_source":"amro-item-master-seed","requires_qc":true}'::jsonb
      )
  ) AS seed_values(
    part_number,
    description,
    item_type,
    category,
    subcategory,
    status,
    lifecycle_status,
    specification,
    manufacturer_name,
    manufacturer_part_number,
    oem_part_number,
    unit_of_measure,
    base_unit_of_measure,
    uom_conversion_factor,
    currency,
    is_active,
    metadata
  )
),
upserted AS (
  INSERT INTO public.amro_item_master (
    tenant_id,
    franchise_id,
    part_number,
    description,
    item_type,
    category,
    subcategory,
    status,
    lifecycle_status,
    specification,
    manufacturer_name,
    manufacturer_part_number,
    oem_part_number,
    unit_of_measure,
    base_unit_of_measure,
    uom_conversion_factor,
    currency,
    is_active,
    metadata,
    updated_at
  )
  SELECT
    tenant_id,
    franchise_id,
    part_number,
    description,
    item_type,
    category,
    subcategory,
    status,
    lifecycle_status,
    specification,
    manufacturer_name,
    manufacturer_part_number,
    oem_part_number,
    unit_of_measure,
    base_unit_of_measure,
    uom_conversion_factor,
    currency,
    is_active,
    metadata,
    now()
  FROM seed_rows
  ON CONFLICT (tenant_id, part_number) DO UPDATE
  SET
    description = EXCLUDED.description,
    item_type = EXCLUDED.item_type,
    category = EXCLUDED.category,
    subcategory = EXCLUDED.subcategory,
    status = EXCLUDED.status,
    lifecycle_status = EXCLUDED.lifecycle_status,
    specification = EXCLUDED.specification,
    manufacturer_name = EXCLUDED.manufacturer_name,
    manufacturer_part_number = EXCLUDED.manufacturer_part_number,
    oem_part_number = EXCLUDED.oem_part_number,
    unit_of_measure = EXCLUDED.unit_of_measure,
    base_unit_of_measure = EXCLUDED.base_unit_of_measure,
    uom_conversion_factor = EXCLUDED.uom_conversion_factor,
    currency = EXCLUDED.currency,
    is_active = EXCLUDED.is_active,
    metadata = EXCLUDED.metadata,
    updated_at = now()
  RETURNING id, tenant_id, franchise_id, part_number
)
INSERT INTO tmp_amro_item_master_upserted (id, tenant_id, franchise_id, part_number)
SELECT id, tenant_id, franchise_id, part_number
FROM upserted;

INSERT INTO public.amro_item_cross_references (
  tenant_id,
  franchise_id,
  item_master_id,
  reference_type,
  reference_part_number,
  reference_description,
  is_active,
  metadata,
  updated_at
)
SELECT
  u.tenant_id,
  u.franchise_id,
  u.id,
  refs.reference_type,
  refs.reference_part_number,
  refs.reference_description,
  true,
  '{"seed_source":"amro-item-master-seed"}'::jsonb,
  now()
FROM tmp_amro_item_master_upserted u
JOIN LATERAL (
  VALUES
    ('alternate', u.part_number || '-ALT', 'Alternate fit-approved part'),
    ('vendor', u.part_number || '-VND', 'Vendor cross-reference')
) AS refs(reference_type, reference_part_number, reference_description) ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.amro_item_cross_references x
  WHERE x.tenant_id = u.tenant_id
    AND x.item_master_id = u.id
    AND x.reference_type = refs.reference_type
    AND x.reference_part_number = refs.reference_part_number
);

INSERT INTO public.amro_item_uom_conversions (
  tenant_id,
  franchise_id,
  item_master_id,
  from_uom,
  to_uom,
  factor,
  rounding_mode,
  is_active,
  metadata,
  updated_at
)
SELECT
  u.tenant_id,
  u.franchise_id,
  u.id,
  'BOX',
  'EA',
  10.0,
  'half_up',
  true,
  '{"seed_source":"amro-item-master-seed"}'::jsonb,
  now()
FROM tmp_amro_item_master_upserted u
WHERE NOT EXISTS (
  SELECT 1
  FROM public.amro_item_uom_conversions c
  WHERE c.tenant_id = u.tenant_id
    AND c.item_master_id = u.id
    AND c.from_uom = 'BOX'
    AND c.to_uom = 'EA'
);

COMMIT;
