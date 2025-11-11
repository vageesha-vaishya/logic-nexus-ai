-- Verification Script: Compare Record Counts
-- Run this on BOTH old and new database to verify data migration

-- Generate a comparison report of all table row counts
SELECT 
  'tenants' as table_name, 
  COUNT(*) as row_count,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM tenants

UNION ALL SELECT 'franchises', COUNT(*), MIN(created_at), MAX(created_at) FROM franchises
UNION ALL SELECT 'profiles', COUNT(*), MIN(created_at), MAX(created_at) FROM profiles
UNION ALL SELECT 'user_roles', COUNT(*), MIN(created_at), MAX(created_at) FROM user_roles
UNION ALL SELECT 'countries', COUNT(*), MIN(created_at), MAX(created_at) FROM countries
UNION ALL SELECT 'cities', COUNT(*), MIN(created_at), MAX(created_at) FROM cities
UNION ALL SELECT 'ports_locations', COUNT(*), MIN(created_at), MAX(created_at) FROM ports_locations
UNION ALL SELECT 'service_types', COUNT(*), MIN(created_at), MAX(created_at) FROM service_types
UNION ALL SELECT 'cargo_types', COUNT(*), MIN(created_at), MAX(created_at) FROM cargo_types
UNION ALL SELECT 'carriers', COUNT(*), MIN(created_at), MAX(created_at) FROM carriers
UNION ALL SELECT 'consignees', COUNT(*), MIN(created_at), MAX(created_at) FROM consignees
UNION ALL SELECT 'incoterms', COUNT(*), MIN(created_at), MAX(created_at) FROM incoterms
UNION ALL SELECT 'vehicles', COUNT(*), MIN(created_at), MAX(created_at) FROM vehicles
UNION ALL SELECT 'warehouses', COUNT(*), MIN(created_at), MAX(created_at) FROM warehouses
UNION ALL SELECT 'accounts', COUNT(*), MIN(created_at), MAX(created_at) FROM accounts
UNION ALL SELECT 'contacts', COUNT(*), MIN(created_at), MAX(created_at) FROM contacts
UNION ALL SELECT 'leads', COUNT(*), MIN(created_at), MAX(created_at) FROM leads
UNION ALL SELECT 'opportunities', COUNT(*), MIN(created_at), MAX(created_at) FROM opportunities
UNION ALL SELECT 'activities', COUNT(*), MIN(created_at), MAX(created_at) FROM activities
UNION ALL SELECT 'quotes', COUNT(*), MIN(created_at), MAX(created_at) FROM quotes
UNION ALL SELECT 'quotation_versions', COUNT(*), MIN(created_at), MAX(created_at) FROM quotation_versions
UNION ALL SELECT 'quotation_version_options', COUNT(*), MIN(created_at), MAX(created_at) FROM quotation_version_options
UNION ALL SELECT 'quote_charges', COUNT(*), MIN(created_at), MAX(created_at) FROM quote_charges
UNION ALL SELECT 'shipments', COUNT(*), MIN(created_at), MAX(created_at) FROM shipments
UNION ALL SELECT 'cargo_details', COUNT(*), MIN(created_at), MAX(created_at) FROM cargo_details
UNION ALL SELECT 'services', COUNT(*), MIN(created_at), MAX(created_at) FROM services
UNION ALL SELECT 'carrier_rates', COUNT(*), MIN(created_at), MAX(created_at) FROM carrier_rates
UNION ALL SELECT 'custom_roles', COUNT(*), MIN(created_at), MAX(created_at) FROM custom_roles
UNION ALL SELECT 'subscription_plans', COUNT(*), MIN(created_at), MAX(created_at) FROM subscription_plans
UNION ALL SELECT 'tenant_subscriptions', COUNT(*), MIN(created_at), MAX(created_at) FROM tenant_subscriptions
UNION ALL SELECT 'email_accounts', COUNT(*), MIN(created_at), MAX(created_at) FROM email_accounts
UNION ALL SELECT 'emails', COUNT(*), MIN(created_at), MAX(created_at) FROM emails
UNION ALL SELECT 'audit_logs', COUNT(*), MIN(created_at), MAX(created_at) FROM audit_logs

ORDER BY table_name;

-- Save this output from both databases and compare!
