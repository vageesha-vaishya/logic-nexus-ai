-- Phase 6 Step 56 — smoke test for core.roles / core.permissions /
-- core.memberships + core.user_has_permission RPC.
--
-- Asserts:
--   A1.  No membership → permission denied.
--   A2.  Module wildcard (sales_manager 'crm:* read') matches 'crm:lead read'.
--   A3.  Same role's write permission matches 'crm:lead write'.
--   A4.  No 'delete' permission was seeded → 'crm:lead delete' denied.
--   A5.  Sales manager does NOT have compliance:screening override.
--   A6.  Switching role to compliance_officer DOES grant override.
--   A7.  Viewer role has *:* read but not write.
--   A8.  Platform admin (*:* *) has everything (god mode).
--   A9.  Suspended membership denies permissions.
--   A10. Expired (past expires_at) membership denies.
--
-- Self-cleaning. No residue beyond the synthetic membership row,
-- which is DELETEd at the end.

DO $smoke$
DECLARE
  v_tenant uuid;
  v_user uuid := gen_random_uuid();
  v_sales_role uuid; v_compliance_role uuid; v_viewer_role uuid; v_platform_role uuid;
  v_membership_id uuid;
  v_result boolean;
BEGIN
  SELECT id INTO v_tenant FROM public.tenants ORDER BY created_at LIMIT 1;
  SELECT id INTO v_sales_role      FROM core.roles WHERE name='sales_manager' AND tenant_id IS NULL;
  SELECT id INTO v_compliance_role FROM core.roles WHERE name='compliance_officer' AND tenant_id IS NULL;
  SELECT id INTO v_viewer_role     FROM core.roles WHERE name='viewer' AND tenant_id IS NULL;
  SELECT id INTO v_platform_role   FROM core.roles WHERE name='platform_admin' AND tenant_id IS NULL;

  v_result := core.user_has_permission(v_tenant, v_user, 'crm:lead', 'read');
  IF v_result THEN RAISE EXCEPTION 'A1'; END IF;
  RAISE NOTICE 'A1 OK';

  INSERT INTO core.memberships (tenant_id, user_id, role_id) VALUES (v_tenant, v_user, v_sales_role)
  RETURNING id INTO v_membership_id;

  v_result := core.user_has_permission(v_tenant, v_user, 'crm:lead', 'read');
  IF NOT v_result THEN RAISE EXCEPTION 'A2'; END IF;
  RAISE NOTICE 'A2 OK — module wildcard';

  v_result := core.user_has_permission(v_tenant, v_user, 'crm:lead', 'write');
  IF NOT v_result THEN RAISE EXCEPTION 'A3'; END IF;
  RAISE NOTICE 'A3 OK';

  v_result := core.user_has_permission(v_tenant, v_user, 'crm:lead', 'delete');
  IF v_result THEN RAISE EXCEPTION 'A4'; END IF;
  RAISE NOTICE 'A4 OK — action mismatch';

  v_result := core.user_has_permission(v_tenant, v_user, 'compliance:screening', 'override');
  IF v_result THEN RAISE EXCEPTION 'A5'; END IF;
  RAISE NOTICE 'A5 OK';

  UPDATE core.memberships SET role_id=v_compliance_role WHERE id=v_membership_id;
  v_result := core.user_has_permission(v_tenant, v_user, 'compliance:screening', 'override');
  IF NOT v_result THEN RAISE EXCEPTION 'A6'; END IF;
  RAISE NOTICE 'A6 OK';

  UPDATE core.memberships SET role_id=v_viewer_role WHERE id=v_membership_id;
  v_result := core.user_has_permission(v_tenant, v_user, 'amro:work_order', 'read');
  IF NOT v_result THEN RAISE EXCEPTION 'A7 read'; END IF;
  v_result := core.user_has_permission(v_tenant, v_user, 'amro:work_order', 'write');
  IF v_result THEN RAISE EXCEPTION 'A7 write'; END IF;
  RAISE NOTICE 'A7 OK — viewer: global wildcard read, no write';

  UPDATE core.memberships SET role_id=v_platform_role WHERE id=v_membership_id;
  v_result := core.user_has_permission(v_tenant, v_user, 'finance:invoice', 'delete');
  IF NOT v_result THEN RAISE EXCEPTION 'A8'; END IF;
  RAISE NOTICE 'A8 OK — god mode';

  UPDATE core.memberships SET status='suspended' WHERE id=v_membership_id;
  v_result := core.user_has_permission(v_tenant, v_user, 'finance:invoice', 'read');
  IF v_result THEN RAISE EXCEPTION 'A9'; END IF;
  RAISE NOTICE 'A9 OK — suspended';

  UPDATE core.memberships SET status='active', expires_at=now() - interval '1 day' WHERE id=v_membership_id;
  v_result := core.user_has_permission(v_tenant, v_user, 'finance:invoice', 'read');
  IF v_result THEN RAISE EXCEPTION 'A10'; END IF;
  RAISE NOTICE 'A10 OK — expired';

  DELETE FROM core.memberships WHERE id=v_membership_id;
  RAISE NOTICE '=== roles/permissions/memberships SMOKE PASSED (10/10) ===';
END;
$smoke$;
