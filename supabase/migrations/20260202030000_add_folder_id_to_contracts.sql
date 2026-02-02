BEGIN;

-- Add folder_id to vendor_contracts
ALTER TABLE public.vendor_contracts 
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.vendor_folders(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_vendor_contracts_folder ON public.vendor_contracts(folder_id);

COMMIT;
