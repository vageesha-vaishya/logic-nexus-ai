-- Export CRM Data
-- Run after master data and configuration

-- Accounts
COPY (
  SELECT * FROM accounts ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: accounts.csv

-- Contacts
COPY (
  SELECT * FROM contacts ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: contacts.csv

-- Leads
COPY (
  SELECT * FROM leads ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: leads.csv

-- Lead Assignment Queue
COPY (
  SELECT * FROM lead_assignment_queue ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: lead_assignment_queue.csv

-- Lead Assignment History
COPY (
  SELECT * FROM lead_assignment_history ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: lead_assignment_history.csv

-- Opportunities
COPY (
  SELECT * FROM opportunities ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: opportunities.csv

-- Opportunity Items
COPY (
  SELECT * FROM opportunity_items ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: opportunity_items.csv

-- Activities
COPY (
  SELECT * FROM activities ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: activities.csv

-- Campaigns
COPY (
  SELECT * FROM campaigns ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: campaigns.csv

-- Campaign Members
COPY (
  SELECT * FROM campaign_members ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: campaign_members.csv

-- Emails
COPY (
  SELECT * FROM emails ORDER BY created_at
) TO STDOUT WITH (FORMAT CSV, HEADER true, QUOTE '"');
-- Save as: emails.csv
