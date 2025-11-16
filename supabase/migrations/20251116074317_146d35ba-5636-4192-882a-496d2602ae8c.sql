-- POD (Proof of Delivery) Support
-- Add POD-related columns to shipments table if they don't exist

DO $$ 
BEGIN
  -- Add pod_status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shipments' 
    AND column_name = 'pod_status'
  ) THEN
    ALTER TABLE public.shipments 
    ADD COLUMN pod_status TEXT DEFAULT 'pending' CHECK (pod_status IN ('pending', 'received', 'rejected', 'disputed'));
  END IF;

  -- Add pod_received_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shipments' 
    AND column_name = 'pod_received_at'
  ) THEN
    ALTER TABLE public.shipments 
    ADD COLUMN pod_received_at TIMESTAMPTZ;
  END IF;

  -- Add pod_received_by column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shipments' 
    AND column_name = 'pod_received_by'
  ) THEN
    ALTER TABLE public.shipments 
    ADD COLUMN pod_received_by TEXT;
  END IF;

  -- Add pod_signature_url column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shipments' 
    AND column_name = 'pod_signature_url'
  ) THEN
    ALTER TABLE public.shipments 
    ADD COLUMN pod_signature_url TEXT;
  END IF;

  -- Add pod_notes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shipments' 
    AND column_name = 'pod_notes'
  ) THEN
    ALTER TABLE public.shipments 
    ADD COLUMN pod_notes TEXT;
  END IF;

  -- Add pod_documents column for storing multiple POD document URLs
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shipments' 
    AND column_name = 'pod_documents'
  ) THEN
    ALTER TABLE public.shipments 
    ADD COLUMN pod_documents JSONB DEFAULT '[]';
  END IF;
END $$;

-- Create index on pod_status for faster queries
CREATE INDEX IF NOT EXISTS idx_shipments_pod_status ON public.shipments(pod_status);

-- Create index on pod_received_at for date-based queries
CREATE INDEX IF NOT EXISTS idx_shipments_pod_received_at ON public.shipments(pod_received_at);

COMMENT ON COLUMN public.shipments.pod_status IS 'Status of proof of delivery: pending, received, rejected, disputed';
COMMENT ON COLUMN public.shipments.pod_received_at IS 'Timestamp when POD was received';
COMMENT ON COLUMN public.shipments.pod_received_by IS 'Name of person who received the shipment';
COMMENT ON COLUMN public.shipments.pod_signature_url IS 'URL to signature image or document';
COMMENT ON COLUMN public.shipments.pod_notes IS 'Additional notes about the delivery';
COMMENT ON COLUMN public.shipments.pod_documents IS 'Array of POD document URLs and metadata';