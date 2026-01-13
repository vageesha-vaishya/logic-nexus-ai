-- =====================================================
-- DATA EXPORT QUERIES
-- Lovable Cloud Database Backup
-- Generated: 2026-01-13
-- =====================================================

-- Run these queries to export data from your source database
-- Use psql with \copy or pg_dump for actual export

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Tenants (run first - parent table)
\copy (SELECT * FROM tenants ORDER BY created_at) TO 'data/tenants.csv' WITH CSV HEADER;

-- Franchises
\copy (SELECT * FROM franchises ORDER BY created_at) TO 'data/franchises.csv' WITH CSV HEADER;

-- Profiles (linked to auth.users)
\copy (SELECT * FROM profiles ORDER BY created_at) TO 'data/profiles.csv' WITH CSV HEADER;

-- User Roles
\copy (SELECT * FROM user_roles ORDER BY assigned_at) TO 'data/user_roles.csv' WITH CSV HEADER;

-- =====================================================
-- CRM TABLES
-- =====================================================

-- Accounts
\copy (SELECT * FROM accounts ORDER BY created_at) TO 'data/accounts.csv' WITH CSV HEADER;

-- Contacts
\copy (SELECT * FROM contacts ORDER BY created_at) TO 'data/contacts.csv' WITH CSV HEADER;

-- Leads
\copy (SELECT * FROM leads ORDER BY created_at) TO 'data/leads.csv' WITH CSV HEADER;

-- Activities
\copy (SELECT * FROM activities ORDER BY created_at) TO 'data/activities.csv' WITH CSV HEADER;

-- Opportunities
\copy (SELECT * FROM opportunities ORDER BY created_at) TO 'data/opportunities.csv' WITH CSV HEADER;

-- =====================================================
-- QUOTES & PRICING
-- =====================================================

-- Quotes
\copy (SELECT * FROM quotes ORDER BY created_at) TO 'data/quotes.csv' WITH CSV HEADER;

-- Quotation Versions
\copy (SELECT * FROM quotation_versions ORDER BY created_at) TO 'data/quotation_versions.csv' WITH CSV HEADER;

-- Quotation Version Options
\copy (SELECT * FROM quotation_version_options ORDER BY created_at) TO 'data/quotation_version_options.csv' WITH CSV HEADER;

-- Quotation Version Option Legs
\copy (SELECT * FROM quotation_version_option_legs ORDER BY created_at) TO 'data/quotation_version_option_legs.csv' WITH CSV HEADER;

-- Quote Charges
\copy (SELECT * FROM quote_charges ORDER BY created_at) TO 'data/quote_charges.csv' WITH CSV HEADER;

-- Quote Items
\copy (SELECT * FROM quote_items ORDER BY created_at) TO 'data/quote_items.csv' WITH CSV HEADER;

-- Customer Selections
\copy (SELECT * FROM customer_selections ORDER BY selected_at) TO 'data/customer_selections.csv' WITH CSV HEADER;

-- =====================================================
-- SHIPMENTS & LOGISTICS
-- =====================================================

-- Shipments
\copy (SELECT * FROM shipments ORDER BY created_at) TO 'data/shipments.csv' WITH CSV HEADER;

-- Cargo Details
\copy (SELECT * FROM cargo_details ORDER BY created_at) TO 'data/cargo_details.csv' WITH CSV HEADER;

-- Tracking Events
\copy (SELECT * FROM tracking_events ORDER BY created_at) TO 'data/tracking_events.csv' WITH CSV HEADER;

-- Customs Documents
\copy (SELECT * FROM customs_documents ORDER BY created_at) TO 'data/customs_documents.csv' WITH CSV HEADER;

-- =====================================================
-- CARRIERS & RATES
-- =====================================================

-- Carriers
\copy (SELECT * FROM carriers ORDER BY created_at) TO 'data/carriers.csv' WITH CSV HEADER;

-- Carrier Rates
\copy (SELECT * FROM carrier_rates ORDER BY created_at) TO 'data/carrier_rates.csv' WITH CSV HEADER;

-- Carrier Rate Charges
\copy (SELECT * FROM carrier_rate_charges ORDER BY created_at) TO 'data/carrier_rate_charges.csv' WITH CSV HEADER;

-- Carrier Service Types
\copy (SELECT * FROM carrier_service_types ORDER BY created_at) TO 'data/carrier_service_types.csv' WITH CSV HEADER;

-- =====================================================
-- REFERENCE DATA
-- =====================================================

-- Continents
\copy (SELECT * FROM continents ORDER BY name) TO 'data/continents.csv' WITH CSV HEADER;

-- Countries
\copy (SELECT * FROM countries ORDER BY name) TO 'data/countries.csv' WITH CSV HEADER;

-- States
\copy (SELECT * FROM states ORDER BY name) TO 'data/states.csv' WITH CSV HEADER;

-- Cities
\copy (SELECT * FROM cities ORDER BY name) TO 'data/cities.csv' WITH CSV HEADER;

-- Ports/Locations
\copy (SELECT * FROM ports_locations ORDER BY name) TO 'data/ports_locations.csv' WITH CSV HEADER;

-- Currencies
\copy (SELECT * FROM currencies ORDER BY code) TO 'data/currencies.csv' WITH CSV HEADER;

-- Incoterms
\copy (SELECT * FROM incoterms ORDER BY code) TO 'data/incoterms.csv' WITH CSV HEADER;

-- Container Sizes
\copy (SELECT * FROM container_sizes ORDER BY name) TO 'data/container_sizes.csv' WITH CSV HEADER;

-- Container Types
\copy (SELECT * FROM container_types ORDER BY name) TO 'data/container_types.csv' WITH CSV HEADER;

-- Cargo Types
\copy (SELECT * FROM cargo_types ORDER BY cargo_type_name) TO 'data/cargo_types.csv' WITH CSV HEADER;

-- Service Types
\copy (SELECT * FROM service_types ORDER BY name) TO 'data/service_types.csv' WITH CSV HEADER;

-- =====================================================
-- CHARGES & PRICING CONFIGURATION
-- =====================================================

-- Charge Bases
\copy (SELECT * FROM charge_bases ORDER BY name) TO 'data/charge_bases.csv' WITH CSV HEADER;

-- Charge Categories
\copy (SELECT * FROM charge_categories ORDER BY name) TO 'data/charge_categories.csv' WITH CSV HEADER;

-- Charge Sides
\copy (SELECT * FROM charge_sides ORDER BY name) TO 'data/charge_sides.csv' WITH CSV HEADER;

-- Charge Tier Config
\copy (SELECT * FROM charge_tier_config ORDER BY name) TO 'data/charge_tier_config.csv' WITH CSV HEADER;

-- Charge Tier Ranges
\copy (SELECT * FROM charge_tier_ranges ORDER BY tier_config_id, min_value) TO 'data/charge_tier_ranges.csv' WITH CSV HEADER;

-- Charge Weight Breaks
\copy (SELECT * FROM charge_weight_breaks ORDER BY name) TO 'data/charge_weight_breaks.csv' WITH CSV HEADER;

-- =====================================================
-- EMAIL & COMMUNICATION
-- =====================================================

-- Email Accounts
\copy (SELECT * FROM email_accounts ORDER BY created_at) TO 'data/email_accounts.csv' WITH CSV HEADER;

-- Emails
\copy (SELECT * FROM emails ORDER BY created_at) TO 'data/emails.csv' WITH CSV HEADER;

-- Email Templates
\copy (SELECT * FROM email_templates ORDER BY created_at) TO 'data/email_templates.csv' WITH CSV HEADER;

-- Queues
\copy (SELECT * FROM queues ORDER BY created_at) TO 'data/queues.csv' WITH CSV HEADER;

-- Queue Members
\copy (SELECT * FROM queue_members ORDER BY joined_at) TO 'data/queue_members.csv' WITH CSV HEADER;

-- Queue Rules
\copy (SELECT * FROM queue_rules ORDER BY priority) TO 'data/queue_rules.csv' WITH CSV HEADER;

-- =====================================================
-- ROLES & PERMISSIONS
-- =====================================================

-- Auth Roles
\copy (SELECT * FROM auth_roles ORDER BY level) TO 'data/auth_roles.csv' WITH CSV HEADER;

-- Auth Permissions
\copy (SELECT * FROM auth_permissions ORDER BY id) TO 'data/auth_permissions.csv' WITH CSV HEADER;

-- Auth Role Permissions
\copy (SELECT * FROM auth_role_permissions ORDER BY role_id) TO 'data/auth_role_permissions.csv' WITH CSV HEADER;

-- Custom Roles
\copy (SELECT * FROM custom_roles ORDER BY created_at) TO 'data/custom_roles.csv' WITH CSV HEADER;

-- Custom Role Permissions
\copy (SELECT * FROM custom_role_permissions ORDER BY role_id) TO 'data/custom_role_permissions.csv' WITH CSV HEADER;

-- User Custom Roles
\copy (SELECT * FROM user_custom_roles ORDER BY assigned_at) TO 'data/user_custom_roles.csv' WITH CSV HEADER;

-- =====================================================
-- SUBSCRIPTIONS & BILLING
-- =====================================================

-- Subscription Plans
\copy (SELECT * FROM subscription_plans ORDER BY tier) TO 'data/subscription_plans.csv' WITH CSV HEADER;

-- Tenant Subscriptions
\copy (SELECT * FROM tenant_subscriptions ORDER BY created_at) TO 'data/tenant_subscriptions.csv' WITH CSV HEADER;

-- Usage Records
\copy (SELECT * FROM usage_records ORDER BY created_at) TO 'data/usage_records.csv' WITH CSV HEADER;

-- =====================================================
-- SYSTEM & AUDIT
-- =====================================================

-- Audit Logs
\copy (SELECT * FROM audit_logs ORDER BY created_at) TO 'data/audit_logs.csv' WITH CSV HEADER;

-- Notifications
\copy (SELECT * FROM notifications ORDER BY created_at) TO 'data/notifications.csv' WITH CSV HEADER;

-- System Settings
\copy (SELECT * FROM system_settings ORDER BY created_at) TO 'data/system_settings.csv' WITH CSV HEADER;

-- Dashboard Preferences
\copy (SELECT * FROM dashboard_preferences ORDER BY created_at) TO 'data/dashboard_preferences.csv' WITH CSV HEADER;

-- =====================================================
-- FULL pg_dump COMMAND
-- =====================================================
-- For a complete dump with data, run:
-- 
-- pg_dump "postgresql://postgres:[PASSWORD]@db.pqptgpntbthrisnuwwzi.supabase.co:5432/postgres" \
--   --no-owner \
--   --no-privileges \
--   --exclude-schema=auth \
--   --exclude-schema=storage \
--   --exclude-schema=realtime \
--   --exclude-schema=supabase_functions \
--   --exclude-schema=vault \
--   -f full-backup.sql
--
-- For data only:
-- pg_dump "postgresql://postgres:[PASSWORD]@db.pqptgpntbthrisnuwwzi.supabase.co:5432/postgres" \
--   --data-only \
--   --no-owner \
--   --no-privileges \
--   --exclude-schema=auth \
--   --exclude-schema=storage \
--   -f data-only.sql
