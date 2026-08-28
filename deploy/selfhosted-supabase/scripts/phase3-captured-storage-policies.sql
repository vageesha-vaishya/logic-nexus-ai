-- Phase 3: captured output of phase3-generate-storage-policies.sql run
-- against production (project gzhxgoigflftharcmdqj) on 2026-08-28.
-- NOTE: production had 31 RLS policies on storage.objects at capture time,
-- not the 26 the Task 1 brief assumed (see task-1-report.md for details).
-- This file is a point-in-time capture for one-time application to
-- self-hosted; it is not idempotent (re-running will error on duplicate
-- policy names) and is not meant to be re-run routinely.
CREATE POLICY "Authenticated Delete Access for Organization Assets" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'organization-assets'::text) AND (is_platform_admin(auth.uid()) OR ((storage.foldername(name))[1] = (( SELECT get_user_tenant_id(auth.uid()) AS get_user_tenant_id))::text))));

CREATE POLICY "Authenticated Update Access for Organization Assets" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'organization-assets'::text) AND (is_platform_admin(auth.uid()) OR ((storage.foldername(name))[1] = (( SELECT get_user_tenant_id(auth.uid()) AS get_user_tenant_id))::text))));

CREATE POLICY "Authenticated Upload Access for Organization Assets" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'organization-assets'::text) AND (is_platform_admin(auth.uid()) OR ((storage.foldername(name))[1] = (( SELECT get_user_tenant_id(auth.uid()) AS get_user_tenant_id))::text))));

CREATE POLICY "Commodity Docs Delete" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING ((bucket_id = 'commodity-docs'::text));

CREATE POLICY "Commodity Docs Public Access" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING ((bucket_id = 'commodity-docs'::text));

CREATE POLICY "Commodity Docs Upload" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'commodity-docs'::text));

CREATE POLICY "Platform admins can access all backups" ON storage.objects AS PERMISSIVE FOR ALL TO authenticated
  USING (((bucket_id = 'db-backups'::text) AND (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'platform_admin'::app_role))))));

CREATE POLICY "Public Read Access for Organization Assets" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING ((bucket_id = 'organization-assets'::text));

CREATE POLICY "Users can delete their own backups" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'db-backups'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

CREATE POLICY "Users can delete their own email attachments" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'email-attachments'::text) AND (auth.uid() = owner)));

CREATE POLICY "Users can update their own backups" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'db-backups'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

CREATE POLICY "Users can upload email attachments" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'email-attachments'::text));

CREATE POLICY "Users can upload their own backups" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'db-backups'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

CREATE POLICY "Users can view email attachments" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING ((bucket_id = 'email-attachments'::text));

CREATE POLICY "Users can view their own backups" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'db-backups'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));

CREATE POLICY "Vendor Docs Tenant Access" ON storage.objects AS PERMISSIVE FOR ALL TO public
  USING (((bucket_id = 'vendor-documents'::text) AND (auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM vendors v
  WHERE (((v.id)::text = (storage.foldername(v.name))[1]) AND ((v.tenant_id = ( SELECT profiles.tenant_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))) OR (v.tenant_id IS NULL)))))))
  WITH CHECK (((bucket_id = 'vendor-documents'::text) AND (auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM vendors v
  WHERE (((v.id)::text = (storage.foldername(v.name))[1]) AND ((v.tenant_id = ( SELECT profiles.tenant_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))) OR (v.tenant_id IS NULL)))))));

CREATE POLICY app_attachments_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'app-attachments'::text) AND (is_platform_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM file_attachments fa
  WHERE ((fa.storage_bucket = 'app-attachments'::text) AND (fa.file_path = objects.name) AND (fa.is_public = false) AND (fa.tenant_id = get_user_tenant_id(auth.uid())) AND ((get_user_franchise_id(auth.uid()) IS NULL) OR (fa.franchise_id IS NULL) OR (fa.franchise_id = get_user_franchise_id(auth.uid())))))))));

CREATE POLICY app_attachments_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'app-attachments'::text) AND (is_platform_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM file_attachments fa
  WHERE ((fa.storage_bucket = 'app-attachments'::text) AND (fa.file_path = objects.name) AND (fa.is_public = false) AND (fa.tenant_id = get_user_tenant_id(auth.uid())) AND ((get_user_franchise_id(auth.uid()) IS NULL) OR (fa.franchise_id IS NULL) OR (fa.franchise_id = get_user_franchise_id(auth.uid())))))))));

CREATE POLICY app_attachments_public_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'app-attachments-public'::text) AND (is_platform_admin(auth.uid()) OR ((storage.foldername(name))[1] = (get_user_tenant_id(auth.uid()))::text))));

CREATE POLICY app_attachments_public_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'app-attachments-public'::text) AND (is_platform_admin(auth.uid()) OR ((storage.foldername(name))[1] = (get_user_tenant_id(auth.uid()))::text))));

CREATE POLICY app_attachments_public_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'app-attachments-public'::text) AND (is_platform_admin(auth.uid()) OR ((storage.foldername(name))[1] = (get_user_tenant_id(auth.uid()))::text))));

CREATE POLICY app_attachments_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'app-attachments'::text) AND (is_platform_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM file_attachments fa
  WHERE ((fa.storage_bucket = 'app-attachments'::text) AND (fa.file_path = objects.name) AND (fa.is_public = false) AND (fa.tenant_id = get_user_tenant_id(auth.uid())) AND ((get_user_franchise_id(auth.uid()) IS NULL) OR (fa.franchise_id IS NULL) OR (fa.franchise_id = get_user_franchise_id(auth.uid())))))))));

CREATE POLICY app_attachments_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'app-attachments'::text) AND (is_platform_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM file_attachments fa
  WHERE ((fa.storage_bucket = 'app-attachments'::text) AND (fa.file_path = objects.name) AND (fa.is_public = false) AND (fa.tenant_id = get_user_tenant_id(auth.uid())) AND ((get_user_franchise_id(auth.uid()) IS NULL) OR (fa.franchise_id IS NULL) OR (fa.franchise_id = get_user_franchise_id(auth.uid())))))))));

CREATE POLICY directive_attachments_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'directive-attachments'::text) AND (is_platform_admin(auth.uid()) OR (((storage.foldername(name))[1] = (get_user_tenant_id(auth.uid()))::text) AND (EXISTS ( SELECT 1
   FROM directives d
  WHERE (((d.id)::text = COALESCE((storage.foldername(objects.name))[2], ''::text)) AND (d.tenant_id = get_user_tenant_id(auth.uid())) AND ((get_user_franchise_id(auth.uid()) IS NULL) OR (d.franchise_id IS NULL) OR (d.franchise_id = get_user_franchise_id(auth.uid()))))))))));

CREATE POLICY directive_attachments_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'directive-attachments'::text) AND (is_platform_admin(auth.uid()) OR (((storage.foldername(name))[1] = (get_user_tenant_id(auth.uid()))::text) AND (EXISTS ( SELECT 1
   FROM directives d
  WHERE (((d.id)::text = COALESCE((storage.foldername(objects.name))[2], ''::text)) AND (d.tenant_id = get_user_tenant_id(auth.uid())) AND ((get_user_franchise_id(auth.uid()) IS NULL) OR (d.franchise_id IS NULL) OR (d.franchise_id = get_user_franchise_id(auth.uid()))))))))));

CREATE POLICY directive_attachments_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'directive-attachments'::text) AND (is_platform_admin(auth.uid()) OR (((storage.foldername(name))[1] = (get_user_tenant_id(auth.uid()))::text) AND (EXISTS ( SELECT 1
   FROM directives d
  WHERE (((d.id)::text = COALESCE((storage.foldername(objects.name))[2], ''::text)) AND (d.tenant_id = get_user_tenant_id(auth.uid())) AND ((get_user_franchise_id(auth.uid()) IS NULL) OR (d.franchise_id IS NULL) OR (d.franchise_id = get_user_franchise_id(auth.uid()))))))))));

CREATE POLICY directive_attachments_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'directive-attachments'::text) AND (is_platform_admin(auth.uid()) OR (((storage.foldername(name))[1] = (get_user_tenant_id(auth.uid()))::text) AND (EXISTS ( SELECT 1
   FROM directives d
  WHERE (((d.id)::text = COALESCE((storage.foldername(objects.name))[2], ''::text)) AND (d.tenant_id = get_user_tenant_id(auth.uid())) AND ((get_user_franchise_id(auth.uid()) IS NULL) OR (d.franchise_id IS NULL) OR (d.franchise_id = get_user_franchise_id(auth.uid()))))))))));

CREATE POLICY tenant_branding_admin_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'tenant-branding'::text) AND (EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = ( SELECT auth.uid() AS uid)) AND (ur.role = ANY (ARRAY['tenant_admin'::app_role, 'platform_admin'::app_role])) AND ((ur.tenant_id)::text = (storage.foldername(objects.name))[1]))))));

CREATE POLICY tenant_branding_admin_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'tenant-branding'::text) AND (EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = ( SELECT auth.uid() AS uid)) AND (ur.role = ANY (ARRAY['tenant_admin'::app_role, 'platform_admin'::app_role])) AND ((ur.tenant_id)::text = (storage.foldername(objects.name))[1]))))));

CREATE POLICY tenant_branding_admin_write ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'tenant-branding'::text) AND (EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = ( SELECT auth.uid() AS uid)) AND (ur.role = ANY (ARRAY['tenant_admin'::app_role, 'platform_admin'::app_role])) AND ((ur.tenant_id)::text = (storage.foldername(objects.name))[1]))))));

CREATE POLICY tenant_branding_public_read ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING ((bucket_id = 'tenant-branding'::text));
