-- Create storage bucket for email attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-attachments', 'email-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for email-attachments bucket

-- Allow authenticated users to upload attachments
CREATE POLICY "Users can upload email attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'email-attachments');

-- Allow authenticated users to view attachments
-- Ideally, we should restrict this, but for now, authenticated users can view/download
CREATE POLICY "Users can view email attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'email-attachments');

-- Allow users to delete their own attachments (optional, for cleanup)
CREATE POLICY "Users can delete their own email attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'email-attachments' AND auth.uid() = owner);
