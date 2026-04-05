-- AMRO comprehensive inventory seed validation (500-1000 items)
-- Usage:
--   psql "$DATABASE_URL" -f scripts/sql/validate_amro_inventory_comprehensive_seed.sql

\echo '--- Resolve target tenant (Deccan preferred) ---'
WITH target_tenant AS (
  SELECT id, name, slug
  FROM public.tenants
  WHERE lower(slug) = 'deccan' OR lower(name) = 'deccan'
  ORDER BY created_at ASC
  LIMIT 1
)
SELECT * FROM target_tenant;

\echo '--- Inventory count and composition checks ---'
WITH target_tenant AS (
  SELECT id AS tenant_id
  FROM public.tenants
  WHERE lower(slug) = 'deccan' OR lower(name) = 'deccan'
  ORDER BY created_at ASC
  LIMIT 1
),
counts AS (
  SELECT
    COUNT(*) AS inventory_count,
    COUNT(*) FILTER (WHERE item_type = 'part') AS part_count,
    COUNT(*) FILTER (WHERE item_type = 'consumable') AS consumable_count,
    COUNT(*) FILTER (WHERE item_type = 'tool') AS tool_count,
    COUNT(*) FILTER (WHERE item_type = 'equipment') AS equipment_count,
    COUNT(*) FILTER (WHERE ata_chapter IS NOT NULL) AS ata_mapped_count,
    COUNT(*) FILTER (WHERE certification_reference IS NOT NULL) AS certification_count,
    COUNT(*) FILTER (WHERE barcode_value IS NOT NULL) AS barcode_count,
    COUNT(*) FILTER (WHERE rfid_tag IS NOT NULL) AS rfid_count
  FROM public.parts_inventory p
  JOIN target_tenant t ON t.tenant_id = p.tenant_id
)
SELECT
  *,
  (inventory_count BETWEEN 500 AND 1000) AS inventory_count_ok,
  (part_count > 0 AND consumable_count > 0 AND tool_count > 0 AND equipment_count > 0) AS composition_ok,
  (ata_mapped_count > 0 AND certification_count > 0) AS compliance_mapping_ok,
  (barcode_count > 0 AND rfid_count > 0) AS traceability_tags_ok
FROM counts;

\echo '--- Workflow and automation checks ---'
WITH target_tenant AS (
  SELECT id AS tenant_id
  FROM public.tenants
  WHERE lower(slug) = 'deccan' OR lower(name) = 'deccan'
  ORDER BY created_at ASC
  LIMIT 1
)
SELECT
  (SELECT COUNT(*) FROM public.stock_movements sm JOIN target_tenant t ON t.tenant_id = sm.tenant_id WHERE sm.reference_type = 'seed_receipt') AS seed_receipt_movements,
  (SELECT COUNT(*) FROM public.reservations r JOIN target_tenant t ON t.tenant_id = r.tenant_id WHERE r.status = 'active') AS active_reservations,
  (SELECT COUNT(*) FROM public.amro_inventory_reorder_queue q JOIN target_tenant t ON t.tenant_id = q.tenant_id WHERE q.status = 'pending') AS pending_reorders,
  (SELECT COUNT(*) FROM public.amro_inventory_scan_events s JOIN target_tenant t ON t.tenant_id = s.tenant_id) AS scan_events,
  (SELECT COUNT(*) FROM public.amro_inventory_work_order_links w JOIN target_tenant t ON t.tenant_id = w.tenant_id) AS work_order_links;

\echo '--- Data integrity checks ---'
WITH target_tenant AS (
  SELECT id AS tenant_id
  FROM public.tenants
  WHERE lower(slug) = 'deccan' OR lower(name) = 'deccan'
  ORDER BY created_at ASC
  LIMIT 1
)
SELECT
  COUNT(*) FILTER (WHERE quantity_reserved <= quantity_on_hand) AS valid_reserved_rows,
  COUNT(*) AS total_rows,
  (COUNT(*) FILTER (WHERE quantity_reserved <= quantity_on_hand) = COUNT(*)) AS reserved_constraint_ok
FROM public.parts_inventory p
JOIN target_tenant t ON t.tenant_id = p.tenant_id;

\echo '--- Health overview snapshot ---'
WITH target_tenant AS (
  SELECT id AS tenant_id
  FROM public.tenants
  WHERE lower(slug) = 'deccan' OR lower(name) = 'deccan'
  ORDER BY created_at ASC
  LIMIT 1
)
SELECT *
FROM public.amro_inventory_health_overview h
JOIN target_tenant t ON t.tenant_id = h.tenant_id;
