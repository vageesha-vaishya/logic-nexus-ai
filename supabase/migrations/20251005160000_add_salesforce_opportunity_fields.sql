-- Add Salesforce linkage fields to opportunities for external sync
BEGIN;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS salesforce_opportunity_id TEXT,
  ADD COLUMN IF NOT EXISTS salesforce_sync_status TEXT CHECK (salesforce_sync_status IN ('pending','success','error')),
  ADD COLUMN IF NOT EXISTS salesforce_last_synced TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS salesforce_error TEXT;

-- Helpful index for quick lookups
CREATE INDEX IF NOT EXISTS idx_opportunities_salesforce_id ON public.opportunities(salesforce_opportunity_id);

COMMIT;