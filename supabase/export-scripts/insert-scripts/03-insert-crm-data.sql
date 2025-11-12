-- ==========================================
-- PHASE 3: CRM DATA INSERT STATEMENTS
-- ==========================================
-- Execute this after Phase 2 (configuration data)
-- Depends on: tenants, franchises, profiles

-- ==========================================
-- Accounts
-- ==========================================
SELECT 'INSERT INTO accounts (id, tenant_id, franchise_id, name, account_type, industry, website, phone, email, status, billing_address, shipping_address, annual_revenue, employee_count, description, owner_id, parent_account_id, created_by, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L::jsonb, %L::jsonb, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, franchise_id, name, account_type, industry, website, phone, email, status, billing_address::text, shipping_address::text, annual_revenue, employee_count, description, owner_id, parent_account_id, created_by, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM accounts
WHERE EXISTS (SELECT 1 FROM accounts LIMIT 1);

-- ==========================================
-- Contacts
-- ==========================================
SELECT 'INSERT INTO contacts (id, tenant_id, franchise_id, account_id, first_name, last_name, title, email, phone, mobile, address, linkedin_url, notes, is_primary, owner_id, created_by, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L::jsonb, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, franchise_id, account_id, first_name, last_name, title, email, phone, mobile, address::text, linkedin_url, notes, is_primary, owner_id, created_by, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM contacts
WHERE EXISTS (SELECT 1 FROM contacts LIMIT 1);

-- ==========================================
-- Leads
-- ==========================================
SELECT 'INSERT INTO leads (id, tenant_id, franchise_id, first_name, last_name, company, title, email, phone, status, source, description, notes, estimated_value, expected_close_date, qualification_status, owner_id, converted_account_id, converted_contact_id, converted_at, lead_score, last_activity_date, conversion_probability, custom_fields, created_by, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L::jsonb, %L, %L, %L)',
      id, tenant_id, franchise_id, first_name, last_name, company, title, email, phone, status, source, description, notes, estimated_value, expected_close_date, qualification_status, owner_id, converted_account_id, converted_contact_id, converted_at, lead_score, last_activity_date, conversion_probability, custom_fields::text, created_by, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM leads
WHERE EXISTS (SELECT 1 FROM leads LIMIT 1);

-- ==========================================
-- Lead Assignment Queue
-- ==========================================
SELECT 'INSERT INTO lead_assignment_queue (id, tenant_id, franchise_id, lead_id, priority, status, assignment_method, assigned_to, assigned_at, error_message, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, franchise_id, lead_id, priority, status, assignment_method, assigned_to, assigned_at, error_message, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM lead_assignment_queue
WHERE EXISTS (SELECT 1 FROM lead_assignment_queue LIMIT 1);

-- ==========================================
-- Lead Assignment History
-- ==========================================
SELECT 'INSERT INTO lead_assignment_history (id, tenant_id, franchise_id, lead_id, assigned_from, assigned_to, assignment_method, reason, created_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, franchise_id, lead_id, assigned_from, assigned_to, assignment_method, reason, created_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM lead_assignment_history
WHERE EXISTS (SELECT 1 FROM lead_assignment_history LIMIT 1);

-- ==========================================
-- Opportunities
-- ==========================================
SELECT 'INSERT INTO opportunities (id, tenant_id, franchise_id, name, account_id, contact_id, lead_id, stage, amount, probability, close_date, description, notes, owner_id, created_by, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, franchise_id, name, account_id, contact_id, lead_id, stage, amount, probability, close_date, description, notes, owner_id, created_by, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM opportunities
WHERE EXISTS (SELECT 1 FROM opportunities LIMIT 1);

-- ==========================================
-- Opportunity Items
-- ==========================================
SELECT 'INSERT INTO opportunity_items (id, opportunity_id, product_name, description, quantity, unit_price, discount, total_price, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, opportunity_id, product_name, description, quantity, unit_price, discount, total_price, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM opportunity_items
WHERE EXISTS (SELECT 1 FROM opportunity_items LIMIT 1);

-- ==========================================
-- Activities
-- ==========================================
SELECT 'INSERT INTO activities (id, tenant_id, franchise_id, activity_type, subject, description, status, priority, due_date, completed_at, account_id, contact_id, lead_id, assigned_to, created_by, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, franchise_id, activity_type, subject, description, status, priority, due_date, completed_at, account_id, contact_id, lead_id, assigned_to, created_by, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM activities
WHERE EXISTS (SELECT 1 FROM activities LIMIT 1);

-- ==========================================
-- Campaigns
-- ==========================================
SELECT 'INSERT INTO campaigns (id, tenant_id, franchise_id, campaign_name, campaign_type, status, start_date, end_date, budget, actual_cost, expected_revenue, description, owner_id, created_by, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      id, tenant_id, franchise_id, campaign_name, campaign_type, status, start_date, end_date, budget, actual_cost, expected_revenue, description, owner_id, created_by, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM campaigns
WHERE EXISTS (SELECT 1 FROM campaigns LIMIT 1);

-- ==========================================
-- Campaign Members
-- ==========================================
SELECT 'INSERT INTO campaign_members (id, campaign_id, lead_id, contact_id, status, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L)',
      id, campaign_id, lead_id, contact_id, status, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM campaign_members
WHERE EXISTS (SELECT 1 FROM campaign_members LIMIT 1);

-- ==========================================
-- Emails
-- ==========================================
SELECT 'INSERT INTO emails (id, tenant_id, franchise_id, account_id, message_id, thread_id, sender, recipients_to, recipients_cc, recipients_bcc, subject, body_text, body_html, sent_date, received_date, is_read, is_starred, folder, labels, attachments, metadata, created_at, updated_at) VALUES ' ||
  string_agg(
    format(
      '(%L, %L, %L, %L, %L, %L, %L, %L::jsonb, %L::jsonb, %L::jsonb, %L, %L, %L, %L, %L, %L, %L, %L, %L::jsonb, %L::jsonb, %L::jsonb, %L, %L)',
      id, tenant_id, franchise_id, account_id, message_id, thread_id, sender, recipients_to::text, recipients_cc::text, recipients_bcc::text, subject, body_text, body_html, sent_date, received_date, is_read, is_starred, folder, labels::text, attachments::text, metadata::text, created_at, updated_at
    ),
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM emails
WHERE EXISTS (SELECT 1 FROM emails LIMIT 1);
