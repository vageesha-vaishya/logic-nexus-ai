-- Create storage bucket for database backups
INSERT INTO storage.buckets (id, name, public)
VALUES ('db-backups', 'db-backups', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for db-backups bucket
-- Allow authenticated users to upload their own backups
CREATE POLICY "Users can upload their own backups"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'db-backups' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to view their own backups
CREATE POLICY "Users can view their own backups"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'db-backups' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to update their own backups
CREATE POLICY "Users can update their own backups"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'db-backups' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own backups
CREATE POLICY "Users can delete their own backups"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'db-backups' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Platform admins can access all backups
CREATE POLICY "Platform admins can access all backups"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'db-backups' AND 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'platform_admin'
  )
);