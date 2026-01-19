-- Add POP3 support columns to email_accounts
ALTER TABLE public.email_accounts
ADD COLUMN IF NOT EXISTS pop3_host text,
ADD COLUMN IF NOT EXISTS pop3_port integer,
ADD COLUMN IF NOT EXISTS pop3_username text,
ADD COLUMN IF NOT EXISTS pop3_password text,
ADD COLUMN IF NOT EXISTS pop3_use_ssl boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pop3_delete_policy text DEFAULT 'keep';

-- Extend provider check to include POP3
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.email_accounts'::regclass
      AND conname = 'email_accounts_provider_check'
  ) THEN
    ALTER TABLE public.email_accounts
    DROP CONSTRAINT email_accounts_provider_check;
  END IF;
  BEGIN
    ALTER TABLE public.email_accounts
    ADD CONSTRAINT email_accounts_provider_check
    CHECK (provider IN ('office365','gmail','smtp_imap','pop3','other'));
  EXCEPTION WHEN duplicate_object THEN
    -- Constraint already exists with desired definition
    NULL;
  END;
END $$;

-- Constrain delete policy values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_accounts_pop3_delete_policy_check'
  ) THEN
    ALTER TABLE public.email_accounts
    ADD CONSTRAINT email_accounts_pop3_delete_policy_check
    CHECK (pop3_delete_policy IN ('keep','delete_after_fetch'));
  END IF;
END $$;

-- Optimize threading queries
ALTER TABLE public.emails
ADD COLUMN IF NOT EXISTS conversation_id text;

CREATE INDEX IF NOT EXISTS idx_emails_conversation_date 
ON public.emails (conversation_id, received_at DESC);

-- Optimize windowed fetch by account/date
CREATE INDEX IF NOT EXISTS idx_emails_account_date
ON public.emails (account_id, received_at DESC);
