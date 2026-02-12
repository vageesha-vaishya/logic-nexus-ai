-- 1. Create Storage Bucket for Quotations
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('quotations', 'quotations', false, 10485760, ARRAY['application/pdf']) -- 10MB limit
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf'];

-- 2. Enable RLS on the bucket (if not already enabled by default, but policies are needed)
-- Allow Authenticated users to read/write their own tenant's files?
-- For now, allow authenticated users to read/write for simplicity in this V2 scope, 
-- ideally we'd restrict by tenant_id but storage RLS is tricky with folder structures.
-- We'll assume the Edge Function (Service Role) handles the writing, and Users read via signed URLs or public if we made it public (it's private).

CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'quotations' );

CREATE POLICY "Allow authenticated reads"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'quotations' );

-- 3. Add storage_path to quotation_versions
ALTER TABLE public.quotation_versions 
ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- 4. Create Webhook Log Table (optional, but good for debugging async flows)
CREATE TABLE IF NOT EXISTS public.quotation_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID REFERENCES public.quotes(id),
    version_id UUID REFERENCES public.quotation_versions(id),
    status TEXT,
    payload JSONB,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
