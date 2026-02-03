
-- Add external_id for robust syncing
ALTER TABLE public.restricted_party_lists 
ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_restricted_party_external_id 
ON public.restricted_party_lists(external_id);
