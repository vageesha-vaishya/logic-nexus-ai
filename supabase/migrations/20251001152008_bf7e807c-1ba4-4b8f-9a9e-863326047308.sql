-- Add additional fields to emails table for better email management
ALTER TABLE public.emails
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS importance text DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS in_reply_to text,
ADD COLUMN IF NOT EXISTS email_references text[],
ADD COLUMN IF NOT EXISTS size_bytes integer,
ADD COLUMN IF NOT EXISTS raw_headers jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS conversation_id text,
ADD COLUMN IF NOT EXISTS internet_message_id text,
ADD COLUMN IF NOT EXISTS has_inline_images boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sync_error text,
ADD COLUMN IF NOT EXISTS last_sync_attempt timestamp with time zone;

-- Add index for better performance on Office 365 conversation tracking
CREATE INDEX IF NOT EXISTS idx_emails_conversation_id ON public.emails(conversation_id);
CREATE INDEX IF NOT EXISTS idx_emails_internet_message_id ON public.emails(internet_message_id);
CREATE INDEX IF NOT EXISTS idx_emails_in_reply_to ON public.emails(in_reply_to);

-- Add index for sync error tracking
CREATE INDEX IF NOT EXISTS idx_emails_sync_error ON public.emails(sync_error) WHERE sync_error IS NOT NULL;