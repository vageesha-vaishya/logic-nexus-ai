-- Add common Salesforce Account standard fields to public.accounts
-- This migration is additive and keeps existing JSONB addresses for compatibility.

BEGIN;

-- Core identifiers and links
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS account_site TEXT,
  ADD COLUMN IF NOT EXISTS parent_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Contact and company details
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS fax TEXT,
  ADD COLUMN IF NOT EXISTS ticker_symbol TEXT,
  ADD COLUMN IF NOT EXISTS ownership TEXT,          -- e.g., Public, Private, Subsidiary
  ADD COLUMN IF NOT EXISTS rating TEXT,             -- e.g., Hot, Warm, Cold
  ADD COLUMN IF NOT EXISTS sic_code TEXT,
  ADD COLUMN IF NOT EXISTS duns_number TEXT,
  ADD COLUMN IF NOT EXISTS naics_code TEXT;

-- Structured Billing Address (to align with Salesforce fields)
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS billing_street TEXT,
  ADD COLUMN IF NOT EXISTS billing_city TEXT,
  ADD COLUMN IF NOT EXISTS billing_state TEXT,
  ADD COLUMN IF NOT EXISTS billing_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS billing_country TEXT;

-- Structured Shipping Address (to align with Salesforce fields)
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS shipping_street TEXT,
  ADD COLUMN IF NOT EXISTS shipping_city TEXT,
  ADD COLUMN IF NOT EXISTS shipping_state TEXT,
  ADD COLUMN IF NOT EXISTS shipping_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS shipping_country TEXT;

-- Optional commercial metadata
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS number_of_locations INTEGER,
  ADD COLUMN IF NOT EXISTS active BOOLEAN,
  ADD COLUMN IF NOT EXISTS sla TEXT,
  ADD COLUMN IF NOT EXISTS sla_expiration_date DATE,
  ADD COLUMN IF NOT EXISTS customer_priority TEXT,
  ADD COLUMN IF NOT EXISTS support_tier TEXT,
  ADD COLUMN IF NOT EXISTS upsell_opportunity TEXT;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_accounts_parent_account_id ON public.accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_account_number ON public.accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_accounts_duns_number ON public.accounts(duns_number);
CREATE INDEX IF NOT EXISTS idx_accounts_sic_code ON public.accounts(sic_code);

COMMIT;