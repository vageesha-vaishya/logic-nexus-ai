-- UIM + AMRO seed validation script
-- Usage (example):
--   psql "$DATABASE_URL" -f scripts/sql/validate_uim_amro_seed.sql

\echo '--- AMRO/UIM Seed Validation ---'

SELECT * FROM public.amro_uim_seed_validation ORDER BY tenant_id;

\echo '--- Constraint Checks ---'

-- At least 2 categories, 3 locations, 2 suppliers, 2 valuation methods and seeded core UIM entities.
SELECT
  tenant_id,
  (categories_count >= 2) AS categories_ok,
  (locations_count >= 3) AS locations_ok,
  (suppliers_count >= 2) AS suppliers_ok,
  (valuation_methods_count >= 2) AS valuation_ok,
  (catalog_items_count >= 2) AS catalog_ok,
  (inventory_items_count >= 2) AS inventory_ok,
  (reservations_count >= 1) AS reservations_ok,
  (ledger_count >= 2) AS ledger_ok
FROM public.amro_uim_seed_validation
ORDER BY tenant_id;

\echo '--- AMRO-linked reservation integrity ---'

SELECT
  r.tenant_id,
  r.reservation_token,
  r.catalog_item_id,
  r.reserved_quantity,
  r.referenced_record_id,
  c.sku,
  c.part_number
FROM public.uim_inventory_reservations r
JOIN public.uim_catalog_items c
  ON c.id = r.catalog_item_id
WHERE r.referenced_module = 'AMRO'
ORDER BY r.created_at DESC
LIMIT 50;
