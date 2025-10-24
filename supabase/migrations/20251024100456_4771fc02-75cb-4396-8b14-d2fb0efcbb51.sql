-- Cleanup to resolve 'already exists' errors before reapplying migrations
DROP TABLE IF EXISTS public.quote_number_sequences CASCADE;
DROP TABLE IF EXISTS public.quote_number_config_franchise CASCADE;
DROP TABLE IF EXISTS public.quote_number_config_tenant CASCADE;
DROP TYPE IF EXISTS quote_reset_policy CASCADE;