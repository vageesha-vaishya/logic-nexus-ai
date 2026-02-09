-- Migration: Email Threat Detection (Phase 2.2)
-- Description: Adds security columns to emails table for malware/phishing tracking.

-- 1. Create security_status enum type
DO $$ BEGIN
    CREATE TYPE public.email_security_status AS ENUM ('pending', 'scanning', 'clean', 'suspicious', 'malicious');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add columns to emails table
ALTER TABLE public.emails
ADD COLUMN IF NOT EXISTS security_status public.email_security_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS security_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS quarantine_reason TEXT,
ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ;

-- 3. Index for security queries
CREATE INDEX IF NOT EXISTS idx_emails_security_status ON public.emails(security_status);
