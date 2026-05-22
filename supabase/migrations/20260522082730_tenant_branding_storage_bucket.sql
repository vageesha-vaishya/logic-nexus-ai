-- tenant-branding storage bucket — for per-tenant logo uploads
-- (Phase BR-4). See docs/plans/2026-05-22-platform-brand-architecture-design.md.
--
-- Path scheme: {tenant_id}/logo.{ext} so RLS can scope writes to the
-- caller's tenant. Public read so the logo can render in <img src=...>
-- on the dashboard without a signed-URL round-trip.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-branding',
  'tenant-branding',
  true,
  2 * 1024 * 1024,
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS tenant_branding_public_read   ON storage.objects;
DROP POLICY IF EXISTS tenant_branding_admin_write   ON storage.objects;
DROP POLICY IF EXISTS tenant_branding_admin_update  ON storage.objects;
DROP POLICY IF EXISTS tenant_branding_admin_delete  ON storage.objects;

CREATE POLICY tenant_branding_public_read
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'tenant-branding');

CREATE POLICY tenant_branding_admin_write
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-branding'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE  ur.user_id   = (SELECT auth.uid())
        AND  ur.role IN ('tenant_admin'::public.app_role, 'platform_admin'::public.app_role)
        AND  ur.tenant_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY tenant_branding_admin_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tenant-branding'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE  ur.user_id   = (SELECT auth.uid())
        AND  ur.role IN ('tenant_admin'::public.app_role, 'platform_admin'::public.app_role)
        AND  ur.tenant_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY tenant_branding_admin_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'tenant-branding'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE  ur.user_id   = (SELECT auth.uid())
        AND  ur.role IN ('tenant_admin'::public.app_role, 'platform_admin'::public.app_role)
        AND  ur.tenant_id::text = (storage.foldername(name))[1]
    )
  );
