-- Export Configuration Data
-- Run after master data export

-- Custom Roles
COPY (
  SELECT * FROM custom_roles ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: custom_roles.csv

-- Custom Role Permissions
COPY (
  SELECT * FROM custom_role_permissions ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: custom_role_permissions.csv

-- User Custom Roles
COPY (
  SELECT * FROM user_custom_roles ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: user_custom_roles.csv

-- Subscription Plans
COPY (
  SELECT * FROM subscription_plans ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: subscription_plans.csv

-- Tenant Subscriptions
COPY (
  SELECT * FROM tenant_subscriptions ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: tenant_subscriptions.csv

-- Usage Records
COPY (
  SELECT * FROM usage_records ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: usage_records.csv

-- Subscription Invoices
COPY (
  SELECT * FROM subscription_invoices ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: subscription_invoices.csv

-- Quote Number Config (Tenant)
COPY (
  SELECT * FROM quote_number_config_tenant ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: quote_number_config_tenant.csv

-- Quote Number Config (Franchise)
COPY (
  SELECT * FROM quote_number_config_franchise ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: quote_number_config_franchise.csv

-- Quote Number Sequences
COPY (
  SELECT * FROM quote_number_sequences ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: quote_number_sequences.csv

-- User Capacity
COPY (
  SELECT * FROM user_capacity ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: user_capacity.csv

-- Assignment Rules
COPY (
  SELECT * FROM assignment_rules ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: assignment_rules.csv

-- Territory Assignments
COPY (
  SELECT * FROM territory_assignments ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: territory_assignments.csv

-- Email Accounts
COPY (
  SELECT * FROM email_accounts ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: email_accounts.csv

-- Email Filters
COPY (
  SELECT * FROM email_filters ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: email_filters.csv

-- Email Templates
COPY (
  SELECT * FROM email_templates ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: email_templates.csv

-- Document Templates
COPY (
  SELECT * FROM document_templates ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: document_templates.csv

-- Compliance Rules
COPY (
  SELECT * FROM compliance_rules ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: compliance_rules.csv

-- Margin Profiles
COPY (
  SELECT * FROM margin_profiles ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: margin_profiles.csv

-- Margin Methods
COPY (
  SELECT * FROM margin_methods ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: margin_methods.csv
