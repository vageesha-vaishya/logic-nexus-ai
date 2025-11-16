-- POD Support Migration: add enum value, shipment flags, and attachment type
-- 1) Add 'proof_of_delivery' to public.document_type enum if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'document_type'
      AND n.nspname = 'public'
      AND e.enumlabel = 'proof_of_delivery'
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'proof_of_delivery';
  END IF;
END
$$;

-- 2) Add POD indicators to shipments
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS pod_received boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pod_received_at timestamptz NULL;

-- 3) Extend shipment_attachments with document_type
ALTER TABLE public.shipment_attachments
  ADD COLUMN IF NOT EXISTS document_type public.document_type NULL;

-- 4) Helpful index for filtering POD attachments per shipment
CREATE INDEX IF NOT EXISTS idx_shipment_attachments_shipment_id_document_type
  ON public.shipment_attachments (shipment_id, document_type);

COMMENT ON COLUMN public.shipments.pod_received IS 'True once POD (proof of delivery) has been received';
COMMENT ON COLUMN public.shipments.pod_received_at IS 'Timestamp when POD was marked received';
COMMENT ON COLUMN public.shipment_attachments.document_type IS 'Document type (e.g., proof_of_delivery) for this attachment';