-- ux_feedback RLS smoke test (Plan 3). Run manually against a database with
-- the 20260915000000_create_ux_feedback.sql migration applied — local dev
-- (supabase db reset) or the self-hosted instance, never automatically.
-- Run with: npm run supabase:exec -- supabase/tests/ux_feedback_rls.sql
-- (or psql against a local instance). Self-cleaning; failure aborts + rolls
-- back (no residue on failure; on success the two synthetic rows this test
-- creates are deleted in the final cleanup block).
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
  -- Borrow three distinct EXISTING auth.users ids rather than inserting new
  -- ones: auth.users is GoTrue-managed with ~30 required columns (see
  -- supabase/migration-package/direct-migration/scripts/sync-auth.js for the
  -- full INSERT), so fabricating rows there directly is fragile across
  -- GoTrue versions and is not what this test is for. Tenants and
  -- user_roles ARE created fresh and are fully self-contained/cleaned up
  -- below -- only the auth.users identities themselves are borrowed, never
  -- modified or deleted. public.user_roles' uniqueness is per
  -- (user_id, role, tenant_id, franchise_id), so granting a borrowed user a
  -- role in a brand-new synthetic tenant cannot collide with whatever real
  -- roles that user already has elsewhere.
  -- Precondition: the target database has at least 3 distinct auth.users
  -- rows (true for any real dev/self-hosted instance that has real users;
  -- this is the same "borrow real seed data" convention already used by
  -- supabase/tests/markets_multibroker_rls.sql for the same reason).
  SELECT id INTO v_user_a FROM auth.users ORDER BY id LIMIT 1;
  SELECT id INTO v_user_b FROM auth.users WHERE id <> v_user_a ORDER BY id LIMIT 1;
  SELECT id INTO v_admin_a FROM auth.users WHERE id NOT IN (v_user_a, v_user_b) ORDER BY id LIMIT 1;

  IF v_user_a IS NULL OR v_user_b IS NULL OR v_admin_a IS NULL THEN
    RAISE NOTICE 'ux_feedback_rls.sql: skipped -- needs at least 3 distinct auth.users rows in this database.';
    RETURN;
  END IF;

  -- Fixture: two fresh tenants, borrowed user_a/user_b as a plain 'user' in
  -- each, borrowed admin_a as tenant_admin in tenant A. slug must be
  -- NOT NULL UNIQUE (public.tenants) -- suffix with a fresh uuid so reruns
  -- never collide.
  INSERT INTO public.tenants (id, name, slug)
    VALUES (gen_random_uuid(), '[smoke_test] UX FB Tenant A', '_smoke_test_ux_fb_tenant_a_' || gen_random_uuid())
    RETURNING id INTO v_tenant_a;
  INSERT INTO public.tenants (id, name, slug)
    VALUES (gen_random_uuid(), '[smoke_test] UX FB Tenant B', '_smoke_test_ux_fb_tenant_b_' || gen_random_uuid())
    RETURNING id INTO v_tenant_b;
  INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (v_user_a, 'user', v_tenant_a);
  INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (v_user_b, 'user', v_tenant_b);
  INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (v_admin_a, 'tenant_admin', v_tenant_a);

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

  -- Cleanup (service-role context restored by RESET ROLE above). Only the
  -- synthetic tenants/roles/feedback row this test created are removed;
  -- the borrowed auth.users rows (v_user_a/v_user_b/v_admin_a) are never
  -- touched -- they are real accounts this test does not own.
  DELETE FROM public.ux_feedback WHERE tenant_id IN (v_tenant_a, v_tenant_b);
  DELETE FROM public.user_roles WHERE tenant_id IN (v_tenant_a, v_tenant_b);
  DELETE FROM public.tenants WHERE id IN (v_tenant_a, v_tenant_b);

  RAISE NOTICE 'ux_feedback_rls.sql: all assertions passed (A1-A5)';
END $$;
