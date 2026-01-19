-- Add unique constraint to email_accounts to prevent duplicate accounts for the same user and email address
ALTER TABLE public.email_accounts
ADD CONSTRAINT unique_user_email UNIQUE (user_id, email_address);
