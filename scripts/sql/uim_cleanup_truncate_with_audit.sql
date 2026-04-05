BEGIN;

CREATE TEMP TABLE tmp_uim_cleanup_counts_before (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE tmp_uim_cleanup_counts_after (
  table_name text PRIMARY KEY,
  row_count bigint NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_uim_cleanup_counts_before (table_name, row_count)
VALUES
  ('uim_form_records', (SELECT count(*) FROM public.uim_form_records)),
  ('uim_inventory_projection_snapshots', (SELECT count(*) FROM public.uim_inventory_projection_snapshots)),
  ('uim_inventory_reservations', (SELECT count(*) FROM public.uim_inventory_reservations)),
  ('uim_inventory_ledger', (SELECT count(*) FROM public.uim_inventory_ledger)),
  ('uim_inventory_items', (SELECT count(*) FROM public.uim_inventory_items)),
  ('uim_catalog_items', (SELECT count(*) FROM public.uim_catalog_items)),
  ('uim_inventory_commands', (SELECT count(*) FROM public.uim_inventory_commands)),
  ('uim_inventory_categories', (SELECT count(*) FROM public.uim_inventory_categories)),
  ('uim_inventory_locations', (SELECT count(*) FROM public.uim_inventory_locations)),
  ('uim_inventory_suppliers', (SELECT count(*) FROM public.uim_inventory_suppliers)),
  ('uim_inventory_valuation_methods', (SELECT count(*) FROM public.uim_inventory_valuation_methods)),
  ('uim_mro_item_profiles', (SELECT count(*) FROM public.uim_mro_item_profiles)),
  ('uim_amro_sync_audit', (SELECT count(*) FROM public.uim_amro_sync_audit)),
  ('uim_amro_sync_jobs', (SELECT count(*) FROM public.uim_amro_sync_jobs)),
  ('amro_uim_inventory_sync_events', (SELECT count(*) FROM public.amro_uim_inventory_sync_events))
ON CONFLICT (table_name) DO UPDATE SET row_count = EXCLUDED.row_count;

TRUNCATE TABLE
  public.uim_form_records,
  public.uim_inventory_projection_snapshots,
  public.uim_inventory_reservations,
  public.uim_inventory_ledger,
  public.uim_inventory_items,
  public.uim_catalog_items,
  public.uim_inventory_commands,
  public.uim_inventory_categories,
  public.uim_inventory_locations,
  public.uim_inventory_suppliers,
  public.uim_inventory_valuation_methods,
  public.uim_mro_item_profiles,
  public.uim_amro_sync_audit,
  public.uim_amro_sync_jobs,
  public.amro_uim_inventory_sync_events
RESTART IDENTITY CASCADE;

INSERT INTO tmp_uim_cleanup_counts_after (table_name, row_count)
VALUES
  ('uim_form_records', (SELECT count(*) FROM public.uim_form_records)),
  ('uim_inventory_projection_snapshots', (SELECT count(*) FROM public.uim_inventory_projection_snapshots)),
  ('uim_inventory_reservations', (SELECT count(*) FROM public.uim_inventory_reservations)),
  ('uim_inventory_ledger', (SELECT count(*) FROM public.uim_inventory_ledger)),
  ('uim_inventory_items', (SELECT count(*) FROM public.uim_inventory_items)),
  ('uim_catalog_items', (SELECT count(*) FROM public.uim_catalog_items)),
  ('uim_inventory_commands', (SELECT count(*) FROM public.uim_inventory_commands)),
  ('uim_inventory_categories', (SELECT count(*) FROM public.uim_inventory_categories)),
  ('uim_inventory_locations', (SELECT count(*) FROM public.uim_inventory_locations)),
  ('uim_inventory_suppliers', (SELECT count(*) FROM public.uim_inventory_suppliers)),
  ('uim_inventory_valuation_methods', (SELECT count(*) FROM public.uim_inventory_valuation_methods)),
  ('uim_mro_item_profiles', (SELECT count(*) FROM public.uim_mro_item_profiles)),
  ('uim_amro_sync_audit', (SELECT count(*) FROM public.uim_amro_sync_audit)),
  ('uim_amro_sync_jobs', (SELECT count(*) FROM public.uim_amro_sync_jobs)),
  ('amro_uim_inventory_sync_events', (SELECT count(*) FROM public.amro_uim_inventory_sync_events))
ON CONFLICT (table_name) DO UPDATE SET row_count = EXCLUDED.row_count;

SELECT
  b.table_name,
  b.row_count AS before_count,
  a.row_count AS after_count
FROM tmp_uim_cleanup_counts_before b
JOIN tmp_uim_cleanup_counts_after a USING (table_name)
ORDER BY b.table_name;

COMMIT;
