-- Drop any existing constraint or index
DROP INDEX IF EXISTS quote_number_sequences_unique_idx;

-- Create a unique partial index for tenant sequences (where franchise_id IS NULL)
CREATE UNIQUE INDEX quote_number_sequences_tenant_unique_idx
ON public.quote_number_sequences (tenant_id, period_key)
WHERE franchise_id IS NULL;

-- Create a unique index for franchise sequences (where franchise_id IS NOT NULL)
CREATE UNIQUE INDEX quote_number_sequences_franchise_unique_idx
ON public.quote_number_sequences (tenant_id, franchise_id, period_key)
WHERE franchise_id IS NOT NULL;