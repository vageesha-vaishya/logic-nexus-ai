BEGIN;

WITH aircraft_counts AS (
  SELECT tenant_id, COUNT(*)::bigint AS aircraft_count
  FROM public.aircraft
  GROUP BY tenant_id
),
parts_inventory_counts AS (
  SELECT tenant_id, COUNT(*)::bigint AS parts_inventory_count
  FROM public.parts_inventory
  GROUP BY tenant_id
),
suppliers_counts AS (
  SELECT tenant_id, COUNT(*)::bigint AS suppliers_count
  FROM public.suppliers
  GROUP BY tenant_id
),
maintenance_facilities_counts AS (
  SELECT tenant_id, COUNT(*)::bigint AS maintenance_facilities_count
  FROM public.maintenance_facilities
  GROUP BY tenant_id
),
work_centers_counts AS (
  SELECT tenant_id, COUNT(*)::bigint AS work_centers_count
  FROM public.work_centers
  GROUP BY tenant_id
),
skill_codes_counts AS (
  SELECT tenant_id, COUNT(*)::bigint AS skill_codes_count
  FROM public.skill_codes
  GROUP BY tenant_id
)
SELECT
  t.id AS tenant_id,
  t.name AS tenant_name,
  t.slug AS tenant_slug,
  COALESCE(a.aircraft_count, 0) AS aircraft_count,
  COALESCE(p.parts_inventory_count, 0) AS parts_inventory_count,
  COALESCE(s.suppliers_count, 0) AS suppliers_count,
  COALESCE(m.maintenance_facilities_count, 0) AS maintenance_facilities_count,
  COALESCE(w.work_centers_count, 0) AS work_centers_count,
  COALESCE(k.skill_codes_count, 0) AS skill_codes_count,
  (
    COALESCE(a.aircraft_count, 0)
    + COALESCE(p.parts_inventory_count, 0)
    + COALESCE(s.suppliers_count, 0)
    + COALESCE(m.maintenance_facilities_count, 0)
    + COALESCE(w.work_centers_count, 0)
    + COALESCE(k.skill_codes_count, 0)
  )::bigint AS total_master_records
FROM public.tenants t
LEFT JOIN aircraft_counts a ON a.tenant_id = t.id
LEFT JOIN parts_inventory_counts p ON p.tenant_id = t.id
LEFT JOIN suppliers_counts s ON s.tenant_id = t.id
LEFT JOIN maintenance_facilities_counts m ON m.tenant_id = t.id
LEFT JOIN work_centers_counts w ON w.tenant_id = t.id
LEFT JOIN skill_codes_counts k ON k.tenant_id = t.id
WHERE
  COALESCE(a.aircraft_count, 0)
  + COALESCE(p.parts_inventory_count, 0)
  + COALESCE(s.suppliers_count, 0)
  + COALESCE(m.maintenance_facilities_count, 0)
  + COALESCE(w.work_centers_count, 0)
  + COALESCE(k.skill_codes_count, 0) > 0
ORDER BY t.name ASC, t.id ASC;

COMMIT;
