-- ux_feedback RLS smoke test (Plan 3). Run manually against a database with
-- the 20260915000000_create_ux_feedback.sql migration applied — local dev
-- (supabase db reset) or the self-hosted instance, never automatically.
-- Run with: npm run supabase:exec -- supabase/tests/ux_feedback_rls.sql
-- (or psql against a local instance). Self-cleaning; failure aborts + rolls
-- back (no residue on failure; on success the single ux_feedback row this
-- test creates in A1 is deleted in the final cleanup block — nothing else
-- is created or touched).
--
-- Asserts:
--   A1. A user can insert a ux_feedback row for their own tenant/user_id.
--   A2. The SAME user cannot insert a row claiming a DIFFERENT tenant_id
--       (RLS WITH CHECK on ux_feedback_insert_own rejects it).
--   A3. A second, unrelated tenant's user cannot SELECT the first tenant's
--       row (RLS USING on ux_feedback_select_admin rejects it for a
--       non-admin role).
--   A4. A tenant_admin in the SAME tenant CAN select the row.
--   A5. No UPDATE policy exists: an UPDATE from the owning user is rejected.

DO $$
DECLARE
  v_tenant_a uuid; v_tenant_b uuid;
  v_user_a uuid; v_user_b uuid; v_admin_a uuid;
  v_row_id uuid;
  v_count integer;
BEGIN
  -- Borrow real (user, tenant, role) triples wholesale rather than creating
  -- any tenants/user_roles rows: public.user_roles carries BOTH
  -- UNIQUE(user_id, role, tenant_id, franchise_id) (20251001011353_...sql)
  -- AND, on top of it, UNIQUE(user_id, role) (added later in
  -- 20251002144430_d298e016-c646-43c9-8cfa-c6d4ad605698.sql) -- so a real
  -- user can hold a given role ('user', 'tenant_admin', ...) in only ONE
  -- tenant, period. A borrowed user very likely already holds 'user'
  -- somewhere, so granting them a second 'user' row in a fresh synthetic
  -- tenant (an earlier draft of this test tried exactly that) would
  -- violate the constraint. Also: auth.users is GoTrue-managed with ~30
  -- required columns (see supabase/migration-package/direct-migration/
  -- scripts/sync-auth.js), too fragile to fabricate directly. Borrowing
  -- everything read-only sidesteps both problems -- same convention
  -- supabase/tests/markets_multibroker_rls.sql already uses for this exact
  -- reason. This test creates and cleans up nothing except the one
  -- ux_feedback row from A1.
  -- Precondition: the target database has at least 2 distinct tenants each
  -- with a 'user'-role member, and tenant A also has a 'tenant_admin'
  -- (true for any real multi-tenant dev/self-hosted instance with seed
  -- data -- not true for a bare, freshly-migrated empty database).
  SELECT user_id, tenant_id INTO v_user_a, v_tenant_a
    FROM public.user_roles WHERE role = 'user'::public.app_role AND tenant_id IS NOT NULL LIMIT 1;
  SELECT user_id, tenant_id INTO v_user_b, v_tenant_b
    FROM public.user_roles
    WHERE role = 'user'::public.app_role AND tenant_id IS NOT NULL AND tenant_id <> v_tenant_a
    LIMIT 1;
  SELECT user_id INTO v_admin_a
    FROM public.user_roles WHERE role = 'tenant_admin'::public.app_role AND tenant_id = v_tenant_a LIMIT 1;

  IF v_tenant_a IS NULL OR v_tenant_b IS NULL OR v_admin_a IS NULL THEN
    RAISE NOTICE 'ux_feedback_rls.sql: skipped -- needs at least 2 distinct tenants each with a ''user''-role member, and tenant A needs a ''tenant_admin''. Run against a database with real multi-tenant seed data.';
    RETURN;
  END IF;

  -- A1: user_a inserts their own row for their own tenant.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a)::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.ux_feedback (tenant_id, user_id, round, route, completed, ease)
  VALUES (v_tenant_a, v_user_a, 1, '/dashboard/leads', 'yes', 4)
  RETURNING id INTO v_row_id;
  RESET ROLE;

  -- A2: user_a tries to insert claiming tenant_b — must fail.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a)::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.ux_feedback (tenant_id, user_id, round, route, completed, ease)
    VALUES (v_tenant_b, v_user_a, 1, '/dashboard/leads', 'yes', 4);
    RAISE EXCEPTION 'A2 FAILED: cross-tenant insert should have been rejected by RLS';
  EXCEPTION WHEN insufficient_privilege OR others THEN
    IF SQLERRM = 'A2 FAILED: cross-tenant insert should have been rejected by RLS' THEN RAISE; END IF;
    NULL; -- expected: RLS rejects the row
  END;
  RESET ROLE;

  -- A3: user_b (different tenant, no admin role) cannot see tenant_a's row.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b)::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM public.ux_feedback WHERE id = v_row_id;
  RESET ROLE;
  IF v_count != 0 THEN RAISE EXCEPTION 'A3 FAILED: user_b should not see tenant_a''s row, saw %', v_count; END IF;

  -- A4: admin_a (tenant_admin, same tenant) CAN see it.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_a)::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM public.ux_feedback WHERE id = v_row_id;
  RESET ROLE;
  IF v_count != 1 THEN RAISE EXCEPTION 'A4 FAILED: tenant_admin should see the row, saw %', v_count; END IF;

  -- A5: no UPDATE policy — the owning user's UPDATE affects zero rows.
  -- (Postgres RLS: absent an UPDATE policy, the row is invisible to the
  -- implicit USING clause, so the statement succeeds with 0 rows affected;
  -- it does NOT raise insufficient_privilege the way a failed INSERT
  -- WITH CHECK does. Assert on ROW_COUNT, not on an exception.)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a)::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE public.ux_feedback SET ease = 5 WHERE id = v_row_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RESET ROLE;
  IF v_count != 0 THEN RAISE EXCEPTION 'A5 FAILED: update should have affected 0 rows (no UPDATE policy), affected %', v_count; END IF;

  -- Cleanup (service-role context restored by RESET ROLE above). Every
  -- tenant/user/role reference this test used is real, pre-existing data
  -- it borrowed and must not touch -- the only row this test owns is the
  -- one ux_feedback insert from A1.
  DELETE FROM public.ux_feedback WHERE id = v_row_id;

  RAISE NOTICE 'ux_feedback_rls.sql: all assertions passed (A1-A5)';
END $$;
