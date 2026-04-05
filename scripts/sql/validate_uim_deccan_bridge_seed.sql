-- Validate Deccan AMRO -> UIM bridge seeding (expect 500-1000 visible items)
-- Usage:
--   psql "$DATABASE_URL" -f scripts/sql/validate_uim_deccan_bridge_seed.sql

\echo '--- Resolve Deccan tenant ---'
WITH deccan AS (
  SELECT id, name, slug
  FROM public.tenants
  WHERE lower(slug) = 'deccan' OR lower(name) = 'deccan'
  ORDER BY created_at ASC
  LIMIT 1
)
SELECT * FROM deccan;

\echo '--- UIM bridged counts ---'
WITH deccan AS (
  SELECT id AS tenant_id
  FROM public.tenants
  WHERE lower(slug) = 'deccan' OR lower(name) = 'deccan'
  ORDER BY created_at ASC
  LIMIT 1
)
SELECT
  d.tenant_id,
  (SELECT COUNT(*) FROM public.uim_catalog_items c WHERE c.tenant_id = d.tenant_id AND c.deleted_at IS NULL AND COALESCE(c.attributes->>'bridge_source', '') = 'amro-parts-inventory') AS bridged_catalog_count,
  (SELECT COUNT(*) FROM public.uim_inventory_items i WHERE i.tenant_id = d.tenant_id AND i.deleted_at IS NULL AND COALESCE(i.metadata->>'bridge_source', '') = 'amro-parts-inventory') AS bridged_inventory_count,
  (SELECT COUNT(*) FROM public.uim_inventory_ledger l WHERE l.tenant_id = d.tenant_id AND l.referenced_module = 'AMRO_BRIDGE') AS bridge_ledger_count,
  (SELECT COUNT(*) FROM public.uim_inventory_projection_snapshots p WHERE p.tenant_id = d.tenant_id) AS projection_count
FROM deccan d;

\echo '--- Range checks (must be true for target) ---'
WITH deccan AS (
  SELECT id AS tenant_id
  FROM public.tenants
  WHERE lower(slug) = 'deccan' OR lower(name) = 'deccan'
  ORDER BY created_at ASC
  LIMIT 1
),
stats AS (
  SELECT
    (SELECT COUNT(*) FROM public.uim_catalog_items c WHERE c.tenant_id = d.tenant_id AND c.deleted_at IS NULL AND COALESCE(c.attributes->>'bridge_source', '') = 'amro-parts-inventory') AS catalog_count,
    (SELECT COUNT(*) FROM public.uim_inventory_items i WHERE i.tenant_id = d.tenant_id AND i.deleted_at IS NULL AND COALESCE(i.metadata->>'bridge_source', '') = 'amro-parts-inventory') AS inventory_count
  FROM deccan d
)
SELECT
  catalog_count,
  inventory_count,
  (catalog_count BETWEEN 500 AND 1000) AS catalog_range_ok,
  (inventory_count BETWEEN 500 AND 1000) AS inventory_range_ok
FROM stats;

\echo '--- Sample item metadata quality ---'
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
  c.category,
  c.attributes->>'ata_chapter' AS ata_chapter,
  c.attributes->>'certification_type' AS certification_type,
  c.attributes->>'certification_reference' AS certification_reference,
  c.attributes->>'criticality' AS criticality
FROM public.uim_catalog_items c
JOIN deccan d ON d.tenant_id = c.tenant_id
WHERE c.deleted_at IS NULL
  AND COALESCE(c.attributes->>'bridge_source', '') = 'amro-parts-inventory'
ORDER BY c.updated_at DESC
LIMIT 20;
