
-- Migration for Vendor Security Features
-- Adds virus scanning status and expiration alert tracking

BEGIN;

-- 1. Create virus_scan_status enum
DO $$ BEGIN
    CREATE TYPE public.virus_scan_status AS ENUM ('pending', 'clean', 'infected', 'skipped');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Update vendor_documents
ALTER TABLE public.vendor_documents
ADD COLUMN IF NOT EXISTS virus_scan_status public.virus_scan_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS virus_scan_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS expiration_alert_sent BOOLEAN DEFAULT false;

-- 3. Update vendor_contract_versions
ALTER TABLE public.vendor_contract_versions
ADD COLUMN IF NOT EXISTS virus_scan_status public.virus_scan_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS virus_scan_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;

-- 4. Update vendor_contracts (for expiration)
ALTER TABLE public.vendor_contracts
ADD COLUMN IF NOT EXISTS expiration_alert_sent BOOLEAN DEFAULT false;

-- 5. Create a function to auto-approve scan (Mock for now, can be replaced by Edge Function webhook later)
CREATE OR REPLACE FUNCTION public.mock_virus_scan()
RETURNS TRIGGER AS $$
BEGIN
    -- In a real system, this would be done by an external service webhook
    -- For now, we auto-mark as clean after insert (simulating async process)
    -- We'll just leave it as 'pending' initially, and maybe have a scheduled job or edge function update it.
    -- Or, we can set it to 'clean' immediately for demo purposes if it's a small file.
    
    -- Let's set it to 'clean' for files < 5MB, 'pending' for others to simulate processing
    IF NEW.file_size < 5242880 THEN
        NEW.virus_scan_status := 'clean';
        NEW.virus_scan_date := now();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Attach trigger
DROP TRIGGER IF EXISTS trigger_mock_virus_scan_docs ON public.vendor_documents;
CREATE TRIGGER trigger_mock_virus_scan_docs
BEFORE INSERT ON public.vendor_documents
FOR EACH ROW EXECUTE FUNCTION public.mock_virus_scan();

DROP TRIGGER IF EXISTS trigger_mock_virus_scan_versions ON public.vendor_contract_versions;
CREATE TRIGGER trigger_mock_virus_scan_versions
BEFORE INSERT ON public.vendor_contract_versions
FOR EACH ROW EXECUTE FUNCTION public.mock_virus_scan();

COMMIT;
