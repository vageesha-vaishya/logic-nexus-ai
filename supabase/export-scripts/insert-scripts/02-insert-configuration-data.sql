-- ==========================================
-- PHASE 2: CONFIGURATION DATA INSERT STATEMENTS
-- ==========================================
-- Execute this after Phase 1 (master data)
-- Depends on: tenants, franchises

-- ==========================================
-- Subscription Plans
-- ==========================================
SELECT 'INSERT INTO subscription_plans (id, plan_name, plan_type, tier, price_monthly, price_yearly, features, limits, is_active, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L::jsonb, %L::jsonb, %L, %L, %L)',
      id, plan_name, plan_type, tier, price_monthly, price_yearly, features::text, limits::text, is_active, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM subscription_plans
WHERE EXISTS (SELECT 1 FROM subscription_plans LIMIT 1);

-- ==========================================
-- Tenant Subscriptions
-- ==========================================
SELECT 'INSERT INTO tenant_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_customer_id, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_customer_id, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM tenant_subscriptions
WHERE EXISTS (SELECT 1 FROM tenant_subscriptions LIMIT 1);

-- ==========================================
-- Usage Records
-- ==========================================
SELECT 'INSERT INTO usage_records (id, tenant_id, feature_key, usage_count, limit_count, period_start, period_end, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, feature_key, usage_count, limit_count, period_start, period_end, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM usage_records
WHERE EXISTS (SELECT 1 FROM usage_records LIMIT 1);

-- ==========================================
-- Subscription Invoices
-- ==========================================
SELECT 'INSERT INTO subscription_invoices (id, tenant_id, subscription_id, stripe_invoice_id, invoice_number, amount_due, amount_paid, currency, status, due_date, paid_at, invoice_pdf_url, billing_reason, metadata, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L::jsonb, %L, %L)',
      id, tenant_id, subscription_id, stripe_invoice_id, invoice_number, amount_due, amount_paid, currency, status, due_date, paid_at, invoice_pdf_url, billing_reason, metadata::text, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM subscription_invoices
WHERE EXISTS (SELECT 1 FROM subscription_invoices LIMIT 1);

-- ==========================================
-- Custom Roles
-- ==========================================
SELECT 'INSERT INTO custom_roles (id, tenant_id, role_name, description, is_active, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, role_name, description, is_active, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM custom_roles
WHERE EXISTS (SELECT 1 FROM custom_roles LIMIT 1);

-- ==========================================
-- Custom Role Permissions
-- ==========================================
SELECT 'INSERT INTO custom_role_permissions (id, role_id, permission_key, access_type, created_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L)',
      id, role_id, permission_key, access_type, created_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM custom_role_permissions
WHERE EXISTS (SELECT 1 FROM custom_role_permissions LIMIT 1);

-- ==========================================
-- User Custom Roles
-- ==========================================
SELECT 'INSERT INTO user_custom_roles (id, user_id, role_id, created_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L)',
      id, user_id, role_id, created_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM user_custom_roles
WHERE EXISTS (SELECT 1 FROM user_custom_roles LIMIT 1);

-- ==========================================
-- Quote Number Config - Tenant
-- ==========================================
SELECT 'INSERT INTO quote_number_config_tenant (id, tenant_id, prefix, reset_policy, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L)',
      id, tenant_id, prefix, reset_policy, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM quote_number_config_tenant
WHERE EXISTS (SELECT 1 FROM quote_number_config_tenant LIMIT 1);

-- ==========================================
-- Quote Number Config - Franchise
-- ==========================================
SELECT 'INSERT INTO quote_number_config_franchise (id, tenant_id, franchise_id, prefix, reset_policy, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, franchise_id, prefix, reset_policy, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM quote_number_config_franchise
WHERE EXISTS (SELECT 1 FROM quote_number_config_franchise LIMIT 1);

-- ==========================================
-- Quote Number Sequences
-- ==========================================
SELECT 'INSERT INTO quote_number_sequences (tenant_id, franchise_id, period_key, last_sequence, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L)',
      tenant_id, franchise_id, period_key, last_sequence, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (tenant_id, franchise_id, period_key) DO UPDATE SET last_sequence = EXCLUDED.last_sequence;'
FROM quote_number_sequences
WHERE EXISTS (SELECT 1 FROM quote_number_sequences LIMIT 1);

-- ==========================================
-- User Capacity
-- ==========================================
SELECT 'INSERT INTO user_capacity (id, user_id, tenant_id, franchise_id, max_leads, current_leads, is_available, last_assigned_at, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, user_id, tenant_id, franchise_id, max_leads, current_leads, is_available, last_assigned_at, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM user_capacity
WHERE EXISTS (SELECT 1 FROM user_capacity LIMIT 1);

-- ==========================================
-- Assignment Rules
-- ==========================================
SELECT 'INSERT INTO assignment_rules (id, tenant_id, franchise_id, rule_name, rule_type, priority, conditions, is_active, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L::jsonb, %L, %L, %L)',
      id, tenant_id, franchise_id, rule_name, rule_type, priority, conditions::text, is_active, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM assignment_rules
WHERE EXISTS (SELECT 1 FROM assignment_rules LIMIT 1);

-- ==========================================
-- Territory Assignments
-- ==========================================
SELECT 'INSERT INTO territory_assignments (id, tenant_id, franchise_id, user_id, territory_name, territory_data, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L::jsonb, %L, %L)',
      id, tenant_id, franchise_id, user_id, territory_name, territory_data::text, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM territory_assignments
WHERE EXISTS (SELECT 1 FROM territory_assignments LIMIT 1);

-- ==========================================
-- Email Accounts
-- ==========================================
SELECT 'INSERT INTO email_accounts (id, user_id, tenant_id, franchise_id, provider, email_address, display_name, access_token, refresh_token, is_primary, is_active, smtp_host, smtp_port, smtp_username, smtp_password, smtp_use_tls, imap_host, imap_port, imap_username, imap_password, imap_use_ssl, token_expires_at, last_sync_at, sync_frequency, auto_sync_enabled, settings, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L::jsonb, %L, %L)',
      id, user_id, tenant_id, franchise_id, provider, email_address, display_name, access_token, refresh_token, is_primary, is_active, smtp_host, smtp_port, smtp_username, smtp_password, smtp_use_tls, imap_host, imap_port, imap_username, imap_password, imap_use_ssl, token_expires_at, last_sync_at, sync_frequency, auto_sync_enabled, settings::text, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM email_accounts
WHERE EXISTS (SELECT 1 FROM email_accounts LIMIT 1);

-- ==========================================
-- Email Filters
-- ==========================================
SELECT 'INSERT INTO email_filters (id, user_id, tenant_id, account_id, name, description, priority, is_active, conditions, actions, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L::jsonb, %L::jsonb, %L, %L)',
      id, user_id, tenant_id, account_id, name, description, priority, is_active, conditions::text, actions::text, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM email_filters
WHERE EXISTS (SELECT 1 FROM email_filters LIMIT 1);

-- ==========================================
-- Email Templates
-- ==========================================
SELECT 'INSERT INTO email_templates (id, tenant_id, franchise_id, template_name, subject, body, template_type, is_active, created_by, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, franchise_id, template_name, subject, body, template_type, is_active, created_by, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM email_templates
WHERE EXISTS (SELECT 1 FROM email_templates LIMIT 1);

-- ==========================================
-- Document Templates
-- ==========================================
SELECT 'INSERT INTO document_templates (id, tenant_id, template_name, document_type, service_type, template_content, required_fields, is_active, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L::jsonb, %L, %L, %L)',
      id, tenant_id, template_name, document_type, service_type, template_content, required_fields::text, is_active, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM document_templates
WHERE EXISTS (SELECT 1 FROM document_templates LIMIT 1);

-- ==========================================
-- Compliance Rules
-- ==========================================
SELECT 'INSERT INTO compliance_rules (id, tenant_id, rule_name, service_type, regulation_agency, rule_description, validation_criteria, required_documents, is_active, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L::jsonb, %L::jsonb, %L, %L, %L)',
      id, tenant_id, rule_name, service_type, regulation_agency, rule_description, validation_criteria::text, required_documents::text, is_active, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM compliance_rules
WHERE EXISTS (SELECT 1 FROM compliance_rules LIMIT 1);

-- ==========================================
-- Margin Methods
-- ==========================================
SELECT 'INSERT INTO margin_methods (id, method_name, calculation_formula, created_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L)',
      id, method_name, calculation_formula, created_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM margin_methods
WHERE EXISTS (SELECT 1 FROM margin_methods LIMIT 1);

-- ==========================================
-- Margin Profiles
-- ==========================================
SELECT 'INSERT INTO margin_profiles (id, tenant_id, default_method_id, default_value, min_margin, rounding_rule, is_active, created_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, default_method_id, default_value, min_margin, rounding_rule, is_active, created_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM margin_profiles
WHERE EXISTS (SELECT 1 FROM margin_profiles LIMIT 1);
