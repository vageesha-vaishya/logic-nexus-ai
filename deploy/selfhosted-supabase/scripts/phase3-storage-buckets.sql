-- Phase 3: replicate production's storage.buckets rows to self-hosted.
-- Source of truth: production project gzhxgoigflftharcmdqj, storage.buckets,
-- captured 2026-08-28. Re-verify against production before re-running if
-- buckets may have changed since (see Task 1 Step 5's verification query).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, avif_autodetection) VALUES
  ('app-attachments', 'app-attachments', false, NULL, NULL, false),
  ('app-attachments-public', 'app-attachments-public', true, NULL, NULL, false),
  ('commodity-docs', 'commodity-docs', true, NULL, NULL, false),
  ('db-backups', 'db-backups', false, NULL, NULL, false),
  ('directive-attachments', 'directive-attachments', false, NULL, NULL, false),
  ('email-attachments', 'email-attachments', false, NULL, NULL, false),
  ('organization-assets', 'organization-assets', true, NULL, NULL, false),
  ('tenant-branding', 'tenant-branding', true, 2097152, ARRAY['image/png','image/jpeg','image/svg+xml','image/webp'], false),
  ('vendor-documents', 'vendor-documents', false, NULL, NULL, false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  avif_autodetection = EXCLUDED.avif_autodetection;
