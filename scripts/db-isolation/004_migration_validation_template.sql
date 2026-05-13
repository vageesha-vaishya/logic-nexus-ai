-- Template: migration validation checks
-- Replace placeholders for source and target tables.

\set ON_ERROR_STOP on

-- 1) Data count verification
SELECT
  (SELECT count(*) FROM module_old.table_old) AS source_count,
  (SELECT count(*) FROM module_new.table_new) AS target_count;

-- 2) Checksum validation sample (deterministic)
SELECT
  md5(string_agg(id::text || '|' || coalesce(updated_at::text, ''), ',' ORDER BY id)) AS source_checksum
FROM module_old.table_old
WHERE tenant_id = :'tenant_id';

SELECT
  md5(string_agg(id::text || '|' || coalesce(updated_at::text, ''), ',' ORDER BY id)) AS target_checksum
FROM module_new.table_new
WHERE tenant_id = :'tenant_id';

-- 3) Sample record comparison
SELECT s.id, s.updated_at AS src_updated_at, t.updated_at AS tgt_updated_at
FROM module_old.table_old s
JOIN module_new.table_new t ON t.id = s.id
WHERE s.tenant_id = :'tenant_id'
ORDER BY s.updated_at DESC
LIMIT 100;
