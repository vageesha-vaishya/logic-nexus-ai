-- Phase 3: generates CREATE POLICY statements for every RLS policy on
-- storage.objects. RUN THIS AGAINST PRODUCTION. Capture the output
-- (one statement per row) and execute it against self-hosted.
SELECT format(
  E'CREATE POLICY %I ON storage.objects AS %s FOR %s TO %s%s%s;',
  policyname,
  permissive,
  cmd,
  array_to_string(roles, ', '),
  CASE WHEN qual IS NOT NULL THEN E'\n  USING (' || qual || ')' ELSE '' END,
  CASE WHEN with_check IS NOT NULL THEN E'\n  WITH CHECK (' || with_check || ')' ELSE '' END
) AS create_policy_sql
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
