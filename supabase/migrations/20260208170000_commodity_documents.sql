-- Create commodity_documents table
CREATE TABLE IF NOT EXISTS public.commodity_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commodity_id UUID NOT NULL REFERENCES public.master_commodities(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.commodity_documents ENABLE ROW LEVEL SECURITY;

-- Policies for commodity_documents
-- Allow all authenticated users to view/add/delete for now (aligns with current permissiveness of commodities)
DROP POLICY IF EXISTS "Authenticated users can view commodity documents" ON public.commodity_documents;
CREATE POLICY "Authenticated users can view commodity documents"
    ON public.commodity_documents FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert commodity documents" ON public.commodity_documents;
CREATE POLICY "Authenticated users can insert commodity documents"
    ON public.commodity_documents FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete commodity documents" ON public.commodity_documents;
CREATE POLICY "Authenticated users can delete commodity documents"
    ON public.commodity_documents FOR DELETE
    TO authenticated
    USING (true);

-- Storage bucket setup
-- Note: We wrap in a DO block to avoid errors if extension or schema issues exist, 
-- but standard Supabase setups have 'storage' schema.
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('commodity-docs', 'commodity-docs', true)
    ON CONFLICT (id) DO NOTHING;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not create storage bucket: %', SQLERRM;
END $$;

-- Storage policies (Applied to storage.objects)
-- We need to drop existing policies first to avoid conflicts if we are re-running or if names clash
DROP POLICY IF EXISTS "Commodity Docs Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Commodity Docs Upload" ON storage.objects;
DROP POLICY IF EXISTS "Commodity Docs Delete" ON storage.objects;

CREATE POLICY "Commodity Docs Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'commodity-docs' );

CREATE POLICY "Commodity Docs Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'commodity-docs' );

CREATE POLICY "Commodity Docs Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'commodity-docs' );
