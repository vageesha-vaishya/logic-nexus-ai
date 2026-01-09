-- Verification: Phase 1 (Foundation & Security)
-- RLS enabled, policy presence, and franchise_id index coverage

-- RLS enabled check (list any tables missing RLS)
SELECT relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND relname IN (
    'accounts','contacts','leads','opportunities','activities','campaigns','emails',
    'quotes','quotation_versions','quotation_version_options','shipments','tracking_events'
  )
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY relname;

-- Policy counts per core table (sanity check)
SELECT tablename, COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'accounts','contacts','leads','opportunities','activities','campaigns','emails',
    'quotes','quotation_versions','quotation_version_options','shipments','tracking_events'
  )
GROUP BY tablename
ORDER BY tablename;

-- Index coverage for tenant_id and franchise_id (reports missing)
WITH expected(indexname) AS (
  SELECT unnest(ARRAY[
    'idx_accounts_tenant_id',
    'idx_accounts_franchise_id',
    'idx_contacts_tenant_id',
    'idx_contacts_franchise_id',
    'idx_leads_tenant_id',
    'idx_leads_franchise_id',
    'idx_opportunities_tenant_id',
    'idx_opportunities_franchise_id',
    'idx_activities_tenant_id',
    'idx_activities_franchise_id',
    'idx_campaigns_tenant_id',
    'idx_campaigns_franchise_id',
    'idx_emails_franchise_id',
    'idx_quotes_tenant_id',
    'idx_quotes_franchise_id',
    'idx_shipments_tenant_id',
    'idx_shipments_franchise_id'
  ])
)
SELECT e.indexname,
       CASE WHEN i.indexname IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM expected e
LEFT JOIN pg_indexes i
  ON i.schemaname = 'public'
 AND i.indexname = e.indexname
ORDER BY e.indexname;

