-- =====================================================
-- 08: DATA EXPORT SCRIPT
-- =====================================================
-- This script exports data from tables in foreign key dependency order
-- Execute this on the OLD database to generate INSERT statements
-- =====================================================

-- Set output to file
-- \o migration-data-export.sql

-- Disable triggers during import
SET session_replication_role = replica;

-- =====================================================
-- EXPORT ORDER (respecting foreign key dependencies)
-- =====================================================

-- 1. INDEPENDENT MASTER DATA (no dependencies)
COPY (SELECT * FROM public.subscription_plans) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: subscription_plans.csv

COPY (SELECT * FROM public.service_types) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: service_types.csv

COPY (SELECT * FROM public.ports_locations) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: ports_locations.csv

COPY (SELECT * FROM public.incoterms) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: incoterms.csv

COPY (SELECT * FROM public.cargo_types) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: cargo_types.csv

COPY (SELECT * FROM public.package_categories) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: package_categories.csv

COPY (SELECT * FROM public.package_sizes) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: package_sizes.csv

COPY (SELECT * FROM public.container_types) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: container_types.csv

COPY (SELECT * FROM public.container_sizes) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: container_sizes.csv

COPY (SELECT * FROM public.currencies) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: currencies.csv

COPY (SELECT * FROM public.charge_categories) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: charge_categories.csv

COPY (SELECT * FROM public.charge_sides) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: charge_sides.csv

COPY (SELECT * FROM public.charge_bases) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: charge_bases.csv

COPY (SELECT * FROM public.hts_codes) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: hts_codes.csv

COPY (SELECT * FROM public.service_type_mappings) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: service_type_mappings.csv

-- 2. TENANTS (independent)
COPY (SELECT * FROM public.tenants) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: tenants.csv

-- 3. SUBSCRIPTION DATA (depends on tenants, subscription_plans)
COPY (SELECT * FROM public.tenant_subscriptions) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: tenant_subscriptions.csv

COPY (SELECT * FROM public.usage_records) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: usage_records.csv

-- 4. FRANCHISES (depends on tenants)
COPY (SELECT * FROM public.franchises) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: franchises.csv

-- 5. PROFILES (from auth.users, independent)
-- Note: This exports from profiles table which should sync with auth.users
COPY (SELECT * FROM public.profiles) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: profiles.csv

-- 6. USER ROLES (depends on profiles, tenants, franchises)
COPY (SELECT * FROM public.user_roles) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: user_roles.csv

-- 7. USER CAPACITY (depends on user_roles, tenants)
COPY (SELECT * FROM public.user_capacity) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: user_capacity.csv

-- 8. CUSTOM ROLES (depends on tenants)
COPY (SELECT * FROM public.custom_roles) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: custom_roles.csv

COPY (SELECT * FROM public.custom_role_permissions) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: custom_role_permissions.csv

COPY (SELECT * FROM public.user_custom_roles) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: user_custom_roles.csv

-- 9. OAUTH CONFIGURATIONS (depends on tenants)
COPY (SELECT * FROM public.oauth_configurations) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: oauth_configurations.csv

-- 10. EMAIL ACCOUNTS (depends on users, tenants, franchises)
COPY (SELECT * FROM public.email_accounts) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: email_accounts.csv

-- 11. CARRIERS (depends on tenants)
COPY (SELECT * FROM public.carriers) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: carriers.csv

-- 12. SERVICES (depends on carriers, tenants, service_types)
COPY (SELECT * FROM public.services) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: services.csv

-- 13. CARRIER RATES (depends on carriers, services)
COPY (SELECT * FROM public.carrier_rates) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: carrier_rates.csv

-- 14. TENANT-SPECIFIC MASTER DATA
COPY (SELECT * FROM public.warehouses) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: warehouses.csv

COPY (SELECT * FROM public.vehicles) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: vehicles.csv

COPY (SELECT * FROM public.consignees) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: consignees.csv

COPY (SELECT * FROM public.cargo_details) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: cargo_details.csv

-- 15. CRM: ACCOUNTS (depends on tenants, franchises)
COPY (SELECT * FROM public.accounts) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: accounts.csv

-- 16. CRM: CONTACTS (depends on accounts)
COPY (SELECT * FROM public.contacts) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: contacts.csv

-- 17. CRM: CAMPAIGNS (depends on tenants, franchises)
COPY (SELECT * FROM public.campaigns) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: campaigns.csv

-- 18. CRM: LEADS (depends on accounts, contacts, campaigns)
COPY (SELECT * FROM public.leads) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: leads.csv

-- 19. CRM: OPPORTUNITIES (depends on accounts, contacts, leads)
COPY (SELECT * FROM public.opportunities) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: opportunities.csv

-- 20. OPPORTUNITY LINE ITEMS (depends on opportunities, services)
COPY (SELECT * FROM public.opportunity_line_items) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: opportunity_line_items.csv

-- 21. ACTIVITIES (depends on accounts, contacts, leads, opportunities)
COPY (SELECT * FROM public.activities) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: activities.csv

-- 22. QUOTE NUMBER CONFIGURATION (depends on tenants, franchises)
COPY (SELECT * FROM public.quote_number_config_tenant) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: quote_number_config_tenant.csv

COPY (SELECT * FROM public.quote_number_config_franchise) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: quote_number_config_franchise.csv

COPY (SELECT * FROM public.quote_number_sequences) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: quote_number_sequences.csv

-- 23. QUOTES (depends on opportunities, accounts, contacts)
COPY (SELECT * FROM public.quotes) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: quotes.csv

-- 24. QUOTATION VERSIONS (depends on quotes)
COPY (SELECT * FROM public.quotation_versions) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: quotation_versions.csv

-- 25. QUOTATION VERSION OPTIONS (depends on quotation_versions, services, carriers)
COPY (SELECT * FROM public.quotation_version_options) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: quotation_version_options.csv

-- 26. CUSTOMER SELECTIONS (depends on quotes, quotation_versions, quotation_version_options)
COPY (SELECT * FROM public.customer_selections) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: customer_selections.csv

-- 27. SHIPMENTS (depends on quotes, carriers, services, warehouses)
COPY (SELECT * FROM public.shipments) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: shipments.csv

-- 28. TRACKING EVENTS (depends on shipments)
COPY (SELECT * FROM public.tracking_events) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: tracking_events.csv

-- 29. ASSIGNMENT SYSTEM
COPY (SELECT * FROM public.territories) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: territories.csv

COPY (SELECT * FROM public.assignment_rules) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: assignment_rules.csv

COPY (SELECT * FROM public.assignment_history) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: assignment_history.csv

COPY (SELECT * FROM public.assignment_queue) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: assignment_queue.csv

-- 30. EMAIL SYSTEM
COPY (SELECT * FROM public.emails) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: emails.csv

COPY (SELECT * FROM public.email_templates) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: email_templates.csv

-- 31. AUDIT LOGS (depends on tenants, users)
COPY (SELECT * FROM public.audit_logs) TO STDOUT WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');
-- Save to: audit_logs.csv

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Count records per table
SELECT 
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- =====================================================
-- END OF DATA EXPORT
-- =====================================================
