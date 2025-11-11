-- Alternative: Export All Tables as JSON
-- This creates a single JSON export per table (easier for backup/restore)
-- Note: JSON exports are easier to inspect but larger files

-- Usage: Run each query and save output to corresponding .json file
-- Example in psql: \o tenants.json
-- Then run the query
-- Then: \o to reset output

-- Master Data
SELECT json_agg(t) FROM (SELECT * FROM tenants ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM franchises ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM profiles ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM user_roles ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM currencies ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM countries ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM cities ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM ports_locations ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM service_types ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM cargo_types ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM carriers ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM consignees ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM incoterms ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM vehicles ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM warehouses ORDER BY created_at) t;

-- CRM Data
SELECT json_agg(t) FROM (SELECT * FROM accounts ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM contacts ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM leads ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM opportunities ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM activities ORDER BY created_at) t;

-- Quotes & Shipments
SELECT json_agg(t) FROM (SELECT * FROM quotes ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM quotation_versions ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM quotation_version_options ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM quote_charges ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM shipments ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM cargo_details ORDER BY created_at) t;

-- Configuration
SELECT json_agg(t) FROM (SELECT * FROM custom_roles ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM subscription_plans ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM tenant_subscriptions ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM quote_number_config_tenant ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM quote_number_config_franchise ORDER BY created_at) t;
SELECT json_agg(t) FROM (SELECT * FROM email_accounts ORDER BY created_at) t;

-- Audit
SELECT json_agg(t) FROM (SELECT * FROM audit_logs ORDER BY created_at) t;
