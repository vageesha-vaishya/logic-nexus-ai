-- Make tenant_id nullable in emails table for platform admins
ALTER TABLE public.emails ALTER COLUMN tenant_id DROP NOT NULL;