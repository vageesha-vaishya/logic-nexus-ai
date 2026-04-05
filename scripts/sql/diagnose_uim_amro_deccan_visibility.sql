-- Diagnose why Deccan AMRO/UIM inventory may not be visible through tenant-scoped APIs.
-- Usage:
--   psql "$DATABASE_URL" -f scripts/sql/diagnose_uim_amro_deccan_visibility.sql

\echo '--- Deccan tenant identity ---'
WITH deccan AS (
  SELECT id, name, slug, is_active
  FROM public.tenants
  WHERE lower(slug) = 'deccan' OR lower(name) = 'deccan'
  ORDER BY created_at ASC
  LIMIT 1
)
SELECT * FROM deccan;

\echo '--- Deccan franchise records ---'
WITH deccan AS (
  SELECT id AS tenant_id
  FROM public.tenants
  WHERE lower(slug) = 'deccan' OR lower(name) = 'deccan'
  ORDER BY created_at ASC
  LIMIT 1
)
SELECT f.id, f.tenant_id, f.name, f.code, f.is_active
FROM public.franchises f
JOIN deccan d ON d.tenant_id = f.tenant_id
ORDER BY f.created_at ASC;

\echo '--- Seeded inventory footprints for Deccan ---'
WITH deccan AS (
  SELECT id AS tenant_id
  FROM public.tenants
  WHERE lower(slug) = 'deccan' OR lower(name) = 'deccan'
  ORDER BY created_at ASC
  LIMIT 1
)
SELECT
  (SELECT count(*) FROM public.uim_catalog_items c JOIN deccan d ON d.tenant_id = c.tenant_id) AS catalog_count,
  (SELECT count(*) FROM public.uim_inventory_items i JOIN deccan d ON d.tenant_id = i.tenant_id) AS inventory_count,
  (SELECT count(*) FROM public.uim_inventory_reservations r JOIN deccan d ON d.tenant_id = r.tenant_id) AS reservation_count,
  (SELECT count(*) FROM public.uim_inventory_ledger l JOIN deccan d ON d.tenant_id = l.tenant_id) AS ledger_count,
  (SELECT count(*) FROM public.amro_uim_inventory_sync_events e JOIN deccan d ON d.tenant_id = e.tenant_id) AS sync_events_count,
  (SELECT count(*) FROM public.uim_form_records f JOIN deccan d ON d.tenant_id = f.tenant_id WHERE f.deleted_at IS NULL) AS form_records_count,
  (SELECT count(*) FROM public.uim_inventory_projection_snapshots p JOIN deccan d ON d.tenant_id = p.tenant_id) AS projection_snapshots_count;

\echo '--- Access context readiness (roles/preferences for Deccan) ---'
WITH deccan AS (
  SELECT id AS tenant_id
  FROM public.tenants
  WHERE lower(slug) = 'deccan' OR lower(name) = 'deccan'
  ORDER BY created_at ASC
  LIMIT 1
)
SELECT
  ur.user_id,
  ur.role,
  ur.tenant_id,
  ur.franchise_id,
  up.tenant_id AS pref_tenant_id,
  up.franchise_id AS pref_franchise_id,
  up.admin_override_enabled
FROM public.user_roles ur
LEFT JOIN public.user_preferences up ON up.user_id = ur.user_id
JOIN deccan d ON d.tenant_id = ur.tenant_id
ORDER BY ur.user_id, ur.role;

\echo '--- Potential visibility blockers ---'
WITH deccan AS (
  SELECT id AS tenant_id
  FROM public.tenants
  WHERE lower(slug) = 'deccan' OR lower(name) = 'deccan'
  ORDER BY created_at ASC
  LIMIT 1
),
checks AS (
  SELECT
    EXISTS (SELECT 1 FROM deccan) AS has_deccan_tenant,
    EXISTS (SELECT 1 FROM public.franchises f JOIN deccan d ON d.tenant_id = f.tenant_id) AS has_franchise,
    EXISTS (SELECT 1 FROM public.uim_catalog_items c JOIN deccan d ON d.tenant_id = c.tenant_id) AS has_catalog_seed,
    EXISTS (SELECT 1 FROM public.uim_inventory_items i JOIN deccan d ON d.tenant_id = i.tenant_id) AS has_inventory_seed,
    EXISTS (SELECT 1 FROM public.uim_form_records f JOIN deccan d ON d.tenant_id = f.tenant_id WHERE f.deleted_at IS NULL) AS has_form_records_seed,
    EXISTS (SELECT 1 FROM public.uim_inventory_projection_snapshots p JOIN deccan d ON d.tenant_id = p.tenant_id) AS has_projection_seed,
    EXISTS (SELECT 1 FROM public.user_roles ur JOIN deccan d ON d.tenant_id = ur.tenant_id) AS has_tenant_roles
)
SELECT
  has_deccan_tenant,
  has_franchise,
  has_catalog_seed,
  has_inventory_seed,
  has_form_records_seed,
  has_projection_seed,
  has_tenant_roles,
  CASE
    WHEN NOT has_deccan_tenant THEN 'MISSING_TENANT'
    WHEN NOT has_franchise THEN 'MISSING_FRANCHISE'
    WHEN NOT has_catalog_seed OR NOT has_inventory_seed THEN 'MISSING_SEED_DATA'
    WHEN NOT has_form_records_seed THEN 'MISSING_FORM_RECORDS_SEED'
    WHEN NOT has_projection_seed THEN 'MISSING_PROJECTION_SEED'
    WHEN NOT has_tenant_roles THEN 'MISSING_ACCESS_SCOPE'
    ELSE 'READY_FOR_API_VISIBILITY'
  END AS diagnosis
FROM checks;
