-- Add missing columns to quote_number_config_tenant
ALTER TABLE public.quote_number_config_tenant
ADD COLUMN IF NOT EXISTS suffix TEXT,
ADD COLUMN IF NOT EXISTS start_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS allow_manual_override BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_reset_bucket TEXT;

-- Add missing columns to quote_number_config_franchise
ALTER TABLE public.quote_number_config_franchise
ADD COLUMN IF NOT EXISTS suffix TEXT,
ADD COLUMN IF NOT EXISTS start_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS allow_manual_override BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_reset_bucket TEXT;

-- Update the quote_reset_policy enum to include weekly and per_customer
ALTER TYPE quote_reset_policy ADD VALUE IF NOT EXISTS 'weekly';
ALTER TYPE quote_reset_policy ADD VALUE IF NOT EXISTS 'per_customer';