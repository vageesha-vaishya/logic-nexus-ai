-- provision_org_tenant — eager B2B tenant provisioning.
-- See docs/plans/2026-05-22-unified-platform-onboarding-design.md.
--
-- Called by the post-signup Auth-hook shim (supabase/functions/provision-on-signup)
-- when raw_user_meta_data.domain_code resolves to a self-serve B2B domain
-- (currently logistics or markets). Idempotent — re-running for the same
-- (user_id, domain_code) returns the existing tenant + assignment + role
-- without creating duplicates.
--
-- What it does atomically:
--   1. Resolve domain_id from p_domain_code
--   2. Read email from auth.users
--   3. If user already has a tenant_admin row under a tenant with this
--      domain_id, return that — done
--   4. Otherwise:
--      a. INSERT tenants (name=p_org_name, domain_id, unique slug)
--      b. INSERT franchises (default for this tenant)
--      c. INSERT profiles (mirror auth.users — same precondition as
--         provision_new_retail_user; user_roles.user_id FKs to profiles)
--      d. INSERT user_roles (signer = tenant_admin)
--      e. INSERT tenant_domain_assignments (plan_id=freemium, status='active')
--      f. INSERT user_active_membership (point at the new role)
--
-- Returns the three new ids as JSONB so the edge function can log them.

CREATE OR REPLACE FUNCTION public.provision_org_tenant(
  p_user_id     uuid,
  p_domain_code text,
  p_org_name    text,
  p_country     text DEFAULT 'IN'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_domain_id     uuid;
  v_tenant_id     uuid;
  v_franchise_id  uuid;
  v_role_id       uuid;
  v_assignment_id uuid;
  v_plan_id       uuid;
  v_email         text;
  v_first_name    text;
  v_last_name     text;
  v_slug          text;
  v_franchise_code text;
  v_freemium_slug text;
BEGIN
  -- Argument guards ---------------------------------------------------------
  IF p_user_id IS NULL OR p_domain_code IS NULL OR p_org_name IS NULL THEN
    RAISE EXCEPTION 'provision_org_tenant: p_user_id, p_domain_code and p_org_name are required';
  END IF;

  -- 1. Resolve domain ------------------------------------------------------
  SELECT id INTO v_domain_id
  FROM   public.platform_domains
  WHERE  code = p_domain_code AND is_active = true;
  IF v_domain_id IS NULL THEN
    RAISE EXCEPTION 'provision_org_tenant: domain "%" not found or inactive', p_domain_code;
  END IF;

  -- 2. Resolve email + metadata from auth.users ----------------------------
  SELECT u.email,
         COALESCE(u.raw_user_meta_data->>'first_name', ''),
         COALESCE(u.raw_user_meta_data->>'last_name',  '')
    INTO v_email, v_first_name, v_last_name
  FROM   auth.users u WHERE u.id = p_user_id;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'provision_org_tenant: auth.users row not found for user_id=%', p_user_id;
  END IF;

  -- 3. Idempotency: if the user already has a tenant_admin role under a
  --    tenant on this domain, return that.
  SELECT ur.id, ur.tenant_id, ur.franchise_id
    INTO v_role_id, v_tenant_id, v_franchise_id
  FROM   public.user_roles ur
  JOIN   public.tenants t ON t.id = ur.tenant_id
  WHERE  ur.user_id     = p_user_id
    AND  ur.role        = 'tenant_admin'::public.app_role
    AND  t.domain_id    = v_domain_id
  ORDER  BY ur.id
  LIMIT  1;

  IF v_tenant_id IS NOT NULL THEN
    SELECT id INTO v_assignment_id
    FROM   public.tenant_domain_assignments
    WHERE  tenant_id = v_tenant_id AND domain_id = v_domain_id
    LIMIT  1;

    RETURN jsonb_build_object(
      'tenant_id',     v_tenant_id,
      'franchise_id',  v_franchise_id,
      'role_id',       v_role_id,
      'assignment_id', v_assignment_id,
      'created',       false
    );
  END IF;

  -- 4a. INSERT tenant -------------------------------------------------------
  -- Slug: lowercased org name + 6-char random tail. We don't trust the
  -- input to be unique so we always append. Collisions are astronomically
  -- unlikely with 6 hex chars; the unique constraint on slug catches them
  -- and the function will raise + rollback.
  v_slug := lower(regexp_replace(p_org_name, '[^a-z0-9]+', '-', 'gi'))
            || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
  -- Trim leading/trailing hyphens
  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');

  INSERT INTO public.tenants (
    name, slug, domain_id, billing_email,
    settings, config, branding_settings,
    subscription_tier, max_franchises, max_users
  )
  VALUES (
    p_org_name, v_slug, v_domain_id, v_email,
    jsonb_build_object('country', COALESCE(p_country, 'IN'), 'source', 'self-onboarding'),
    '{}'::jsonb, '{}'::jsonb,
    'free', 1, 5
  )
  RETURNING id INTO v_tenant_id;

  -- 4b. INSERT default franchise -------------------------------------------
  v_franchise_code := upper(regexp_replace(split_part(v_slug, '-', 1), '[^a-z0-9]+', '', 'gi')) || '-HQ';

  INSERT INTO public.franchises (
    tenant_id, name, code, is_active, user_limit
  )
  VALUES (
    v_tenant_id, p_org_name || ' (HQ)', v_franchise_code, true, 5
  )
  RETURNING id INTO v_franchise_id;

  -- 4c. INSERT public.profiles if missing (mirrors retail provisioning) ----
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (p_user_id, v_email, NULLIF(v_first_name, ''), NULLIF(v_last_name, ''))
  ON CONFLICT (id) DO NOTHING;

  -- 4d. INSERT user_roles (tenant_admin) -----------------------------------
  INSERT INTO public.user_roles (user_id, role, tenant_id, franchise_id)
  VALUES (p_user_id, 'tenant_admin'::public.app_role, v_tenant_id, v_franchise_id)
  RETURNING id INTO v_role_id;

  -- 4e. INSERT tenant_domain_assignments with the freemium plan ------------
  v_freemium_slug := p_domain_code || '-freemium';
  SELECT id INTO v_plan_id
  FROM   public.subscription_plans
  WHERE  slug = v_freemium_slug AND is_active = true
  LIMIT  1;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'provision_org_tenant: freemium plan "%" not found — run migration 20260522045658', v_freemium_slug;
  END IF;

  INSERT INTO public.tenant_domain_assignments (
    tenant_id, domain_id, plan_id,
    subscription_status, is_active,
    activated_at, created_by
  )
  VALUES (
    v_tenant_id, v_domain_id, v_plan_id,
    'active', true,
    now(), p_user_id
  )
  RETURNING id INTO v_assignment_id;

  -- 4f. Point the user's active membership at the new role ----------------
  INSERT INTO public.user_active_membership (user_id, membership_id, updated_at)
  VALUES (p_user_id, v_role_id, now())
  ON CONFLICT (user_id) DO UPDATE
    SET membership_id = EXCLUDED.membership_id,
        updated_at    = now();

  RETURN jsonb_build_object(
    'tenant_id',     v_tenant_id,
    'franchise_id',  v_franchise_id,
    'role_id',       v_role_id,
    'assignment_id', v_assignment_id,
    'created',       true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.provision_org_tenant(uuid, text, text, text)
  TO service_role;

COMMENT ON FUNCTION public.provision_org_tenant(uuid, text, text, text) IS
  'Idempotent post-signup provisioning for B2B tenants. Atomically creates tenant + default franchise + profile + tenant_admin user_roles + tenant_domain_assignments (freemium) + user_active_membership. Re-running for the same (user_id, domain_code) returns the existing ids. Called by supabase/functions/provision-on-signup.';
