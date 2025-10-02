BEGIN;

WITH t AS (
  SELECT id AS tenant_id FROM public.tenants ORDER BY created_at LIMIT 1
), u AS (
  SELECT id AS user_id FROM public.profiles ORDER BY created_at LIMIT 1
)
-- Accounts
INSERT INTO public.accounts (
  tenant_id, name, account_type, status, website, phone, email, description, owner_id, created_by
)
SELECT t.tenant_id, 'Acme Logistics', 'customer', 'active', 'https://acme.example', '+1-555-0100', 'info@acme.example', 'Demo account', u.user_id, u.user_id
FROM t, u;

INSERT INTO public.accounts (
  tenant_id, name, account_type, status, website, phone, email, description, owner_id, created_by
)
SELECT t.tenant_id, 'Globex Manufacturing', 'prospect', 'active', 'https://globex.example', '+1-555-0200', 'hello@globex.example', 'Demo account', u.user_id, u.user_id
FROM t, u;

-- Contacts
INSERT INTO public.contacts (
  tenant_id, account_id, first_name, last_name, title, email, phone, is_primary, owner_id, created_by
)
SELECT t.tenant_id,
       (SELECT id FROM public.accounts WHERE name = 'Acme Logistics' LIMIT 1),
       'Sam', 'Carter', 'Operations Lead', 'sam.carter@acme.example', '+1-555-0101', true, u.user_id, u.user_id
FROM t, u;

INSERT INTO public.contacts (
  tenant_id, account_id, first_name, last_name, title, email, phone, is_primary, owner_id, created_by
)
SELECT t.tenant_id,
       (SELECT id FROM public.accounts WHERE name = 'Globex Manufacturing' LIMIT 1),
       'Jamie', 'Nguyen', 'Procurement', 'jamie.nguyen@globex.example', '+1-555-0201', true, u.user_id, u.user_id
FROM t, u;

-- Leads
INSERT INTO public.leads (
  tenant_id, first_name, last_name, company, title, email, phone, status, source, estimated_value, description, owner_id, created_by
)
SELECT t.tenant_id, 'Pat', 'Lee', 'Acme Logistics', 'Director', 'pat.lee@acme.example', '+1-555-0102', 'qualified', 'website', 25000, 'Discovery underway', u.user_id, u.user_id
FROM t, u;

-- Activities (Email + Meeting/Event)
INSERT INTO public.activities (
  tenant_id, activity_type, status, priority, subject, description, completed_at,
  account_id, contact_id, lead_id, assigned_to, created_by
)
SELECT t.tenant_id, 'email', 'completed', 'medium', 'Intro email to Pat Lee', 'Sent intro with deck', now(),
       (SELECT id FROM public.accounts WHERE name = 'Acme Logistics' LIMIT 1),
       (SELECT id FROM public.contacts WHERE email = 'sam.carter@acme.example' LIMIT 1),
       (SELECT id FROM public.leads WHERE email = 'pat.lee@acme.example' LIMIT 1),
       u.user_id, u.user_id
FROM t, u;

INSERT INTO public.activities (
  tenant_id, activity_type, status, priority, subject, description, due_date,
  account_id, contact_id, lead_id, assigned_to, created_by
)
SELECT t.tenant_id, 'meeting', 'planned', 'high', 'Discovery meeting for Acme', 'Agenda: scope, timeline, budget', now() + interval '2 days',
       (SELECT id FROM public.accounts WHERE name = 'Acme Logistics' LIMIT 1),
       (SELECT id FROM public.contacts WHERE email = 'sam.carter@acme.example' LIMIT 1),
       (SELECT id FROM public.leads WHERE email = 'pat.lee@acme.example' LIMIT 1),
       u.user_id, u.user_id
FROM t, u;

COMMIT;