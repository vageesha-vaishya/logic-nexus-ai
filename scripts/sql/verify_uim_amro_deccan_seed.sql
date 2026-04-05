-- Deccan-specific AMRO/UIM verification report
-- Usage:
--   psql "$DATABASE_URL" -f scripts/sql/verify_uim_amro_deccan_seed.sql

\echo '--- Resolve Deccan tenant ---'
WITH deccan AS (
  SELECT id, name, slug
  FROM public.tenants
  WHERE lower(slug) = 'deccan' OR lower(name) = 'deccan'
  ORDER BY created_at ASC
  LIMIT 1
)
SELECT * FROM deccan;

\echo '--- Deccan seeded counts ---'
WITH deccan AS (
  SELECT id AS tenant_id
  FROM public.tenants
  WHERE lower(slug) = 'deccan' OR lower(name) = 'deccan'
  ORDER BY created_at ASC
  LIMIT 1
)
SELECT
  d.tenant_id,
  (SELECT COUNT(*) FROM public.uim_inventory_categories c WHERE c.tenant_id = d.tenant_id) AS categories_count,
  (SELECT COUNT(*) FROM public.uim_inventory_locations l WHERE l.tenant_id = d.tenant_id) AS locations_count,
  (SELECT COUNT(*) FROM public.uim_inventory_suppliers s WHERE s.tenant_id = d.tenant_id) AS suppliers_count,
  (SELECT COUNT(*) FROM public.uim_inventory_valuation_methods v WHERE v.tenant_id = d.tenant_id) AS valuation_methods_count,
  (SELECT COUNT(*) FROM public.uim_catalog_items c WHERE c.tenant_id = d.tenant_id) AS catalog_count,
  (SELECT COUNT(*) FROM public.uim_inventory_items i WHERE i.tenant_id = d.tenant_id) AS inventory_count,
  (SELECT COUNT(*) FROM public.uim_inventory_reservations r WHERE r.tenant_id = d.tenant_id) AS reservations_count,
  (SELECT COUNT(*) FROM public.uim_inventory_ledger g WHERE g.tenant_id = d.tenant_id) AS ledger_count,
  (SELECT COUNT(*) FROM public.amro_uim_inventory_sync_events e WHERE e.tenant_id = d.tenant_id) AS sync_events_count,
  (SELECT COUNT(*) FROM public.uim_form_records f WHERE f.tenant_id = d.tenant_id AND f.deleted_at IS NULL) AS form_records_count,
  (SELECT COUNT(*) FROM public.uim_inventory_projection_snapshots p WHERE p.tenant_id = d.tenant_id) AS projection_snapshots_count
FROM deccan d;

\echo '--- Deccan expected key records ---'
WITH deccan AS (
  SELECT id AS tenant_id
  FROM public.tenants
  WHERE lower(slug) = 'deccan' OR lower(name) = 'deccan'
  ORDER BY created_at ASC
  LIMIT 1
)
SELECT
  (EXISTS (SELECT 1 FROM public.uim_catalog_items c JOIN deccan d ON c.tenant_id = d.tenant_id WHERE c.sku = 'DECCAN-AMRO-PUMP-001')) AS has_pump_sku,
  (EXISTS (SELECT 1 FROM public.uim_catalog_items c JOIN deccan d ON c.tenant_id = d.tenant_id WHERE c.sku = 'DECCAN-AMRO-FLTR-010')) AS has_filter_sku,
  (EXISTS (SELECT 1 FROM public.uim_inventory_reservations r JOIN deccan d ON r.tenant_id = d.tenant_id WHERE r.reservation_token = 'deccan-amro-reservation-001')) AS has_reservation_token,
  (EXISTS (SELECT 1 FROM public.uim_inventory_locations l JOIN deccan d ON l.tenant_id = d.tenant_id WHERE l.location_code = 'DECCAN-MRO-MAIN')) AS has_main_location;

\echo '--- Deccan AMRO integration status probe data ---'
WITH deccan AS (
  SELECT id AS tenant_id
  FROM public.tenants
  WHERE lower(slug) = 'deccan' OR lower(name) = 'deccan'
  ORDER BY created_at ASC
  LIMIT 1
)
SELECT
  c.sku,
  c.part_number,
  i.serial_number,
  i.quantity,
  i.status,
  r.reservation_token,
  r.reserved_quantity
FROM deccan d
JOIN public.uim_catalog_items c ON c.tenant_id = d.tenant_id
LEFT JOIN public.uim_inventory_items i ON i.tenant_id = d.tenant_id AND i.catalog_item_id = c.id
LEFT JOIN public.uim_inventory_reservations r ON r.tenant_id = d.tenant_id AND r.catalog_item_id = c.id
WHERE c.sku LIKE 'DECCAN-AMRO-%'
ORDER BY c.sku, i.serial_number NULLS LAST;
