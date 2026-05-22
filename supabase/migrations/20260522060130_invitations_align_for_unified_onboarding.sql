-- Invitations — align legacy table with the unified onboarding invite flow
-- (Phase B · task U-B1). See docs/plans/2026-05-22-unified-platform-onboarding-design.md.
--
-- A pre-existing public.invitations table was present from a legacy
-- migration but empty + unused. Rather than rename or duplicate, we
-- extend it with the columns the new accept-invite handler needs:
--   - status (pending|accepted|revoked|expired) + CHECK
--   - accepted_by_user_id  (who consumed the token)
--   - updated_at           (housekeeping)
-- Plus tighten tenant_id to NOT NULL (every invite is tenant-scoped),
-- add a lowercased-email CHECK, a unique partial index on
-- (tenant_id, email) WHERE status='pending' so admins can't spam dupes,
-- and full RLS for tenant_admin / franchise_admin / service_role.
--
-- accept_invitation_by_token is SECURITY DEFINER so the edge function
-- (which runs with the service role) can call it without exposing
-- INSERT access to public RLS. Token is text (legacy schema); the
-- function does a string-equality lookup.

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS status              text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS accepted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz NOT NULL DEFAULT now();

UPDATE public.invitations SET status = 'pending' WHERE status IS NULL;

ALTER TABLE public.invitations ALTER COLUMN tenant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invitations_status_values') THEN
    ALTER TABLE public.invitations
      ADD CONSTRAINT invitations_status_values
      CHECK (status IN ('pending', 'accepted', 'revoked', 'expired'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invitations_email_lower') THEN
    ALTER TABLE public.invitations
      ADD CONSTRAINT invitations_email_lower
      CHECK (email = lower(email));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_invitations_token
  ON public.invitations (token);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_invitations_tenant_email_pending
  ON public.invitations (tenant_id, email)
  WHERE  status = 'pending';

CREATE INDEX IF NOT EXISTS idx_invitations_tenant_status
  ON public.invitations (tenant_id, status);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invitations_tenant_admin_select ON public.invitations;
CREATE POLICY invitations_tenant_admin_select
  ON public.invitations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE  ur.user_id   = (SELECT auth.uid())
        AND  ur.tenant_id = invitations.tenant_id
        AND  ur.role IN ('tenant_admin'::public.app_role, 'platform_admin'::public.app_role)
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE  ur.user_id      = (SELECT auth.uid())
        AND  ur.tenant_id    = invitations.tenant_id
        AND  ur.franchise_id = invitations.franchise_id
        AND  ur.role         = 'franchise_admin'::public.app_role
    )
  );

DROP POLICY IF EXISTS invitations_tenant_admin_insert ON public.invitations;
CREATE POLICY invitations_tenant_admin_insert
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE  ur.user_id   = (SELECT auth.uid())
        AND  ur.tenant_id = invitations.tenant_id
        AND  ur.role IN ('tenant_admin'::public.app_role, 'platform_admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS invitations_tenant_admin_update ON public.invitations;
CREATE POLICY invitations_tenant_admin_update
  ON public.invitations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE  ur.user_id   = (SELECT auth.uid())
        AND  ur.tenant_id = invitations.tenant_id
        AND  ur.role IN ('tenant_admin'::public.app_role, 'platform_admin'::public.app_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE  ur.user_id   = (SELECT auth.uid())
        AND  ur.tenant_id = invitations.tenant_id
        AND  ur.role IN ('tenant_admin'::public.app_role, 'platform_admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS invitations_service_role_all ON public.invitations;
CREATE POLICY invitations_service_role_all
  ON public.invitations FOR ALL TO public
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.invitations IS
  'Magic-link teammate invites. Tenant admins INSERT; recipients accept via the accept-invite edge function which validates the token and inserts the user_roles row. Per docs/plans/2026-05-22-unified-platform-onboarding-design.md. (Token stored as text — legacy schema.)';

CREATE OR REPLACE FUNCTION public.accept_invitation_by_token(
  p_token   text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_invite     public.invitations%ROWTYPE;
  v_email      text;
  v_role_id    uuid;
  v_existing   uuid;
BEGIN
  IF p_token IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'accept_invitation_by_token: p_token and p_user_id are required';
  END IF;

  SELECT * INTO v_invite FROM public.invitations WHERE token = p_token LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF v_invite.status = 'revoked' THEN RAISE EXCEPTION 'invitation_revoked'; END IF;

  IF v_invite.status = 'accepted' THEN
    SELECT id INTO v_role_id
    FROM   public.user_roles
    WHERE  user_id      = p_user_id
      AND  tenant_id    = v_invite.tenant_id
      AND  COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = COALESCE(v_invite.franchise_id, '00000000-0000-0000-0000-000000000000'::uuid)
    LIMIT 1;

    IF v_role_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true, 'role_id', v_role_id,
        'tenant_id', v_invite.tenant_id, 'franchise_id', v_invite.franchise_id,
        'already', true
      );
    END IF;
    RAISE EXCEPTION 'invitation_already_accepted_by_another_user';
  END IF;

  IF v_invite.expires_at <= now() THEN
    UPDATE public.invitations SET status = 'expired', updated_at = now() WHERE id = v_invite.id;
    RAISE EXCEPTION 'invitation_expired';
  END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = p_user_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;
  IF lower(v_email) <> v_invite.email THEN RAISE EXCEPTION 'invitation_email_mismatch'; END IF;

  SELECT id INTO v_existing
  FROM   public.user_roles
  WHERE  user_id      = p_user_id
    AND  tenant_id    = v_invite.tenant_id
    AND  COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(v_invite.franchise_id, '00000000-0000-0000-0000-000000000000'::uuid)
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    v_role_id := v_existing;
  ELSE
    INSERT INTO public.user_roles (user_id, role, tenant_id, franchise_id)
    VALUES (p_user_id, v_invite.role, v_invite.tenant_id, v_invite.franchise_id)
    RETURNING id INTO v_role_id;
  END IF;

  INSERT INTO public.user_active_membership (user_id, membership_id, updated_at)
  VALUES (p_user_id, v_role_id, now())
  ON CONFLICT (user_id) DO UPDATE
    SET membership_id = EXCLUDED.membership_id, updated_at = now();

  UPDATE public.invitations
  SET    status = 'accepted', accepted_at = now(),
         accepted_by_user_id = p_user_id, updated_at = now()
  WHERE  id = v_invite.id;

  RETURN jsonb_build_object(
    'ok', true, 'role_id', v_role_id,
    'tenant_id', v_invite.tenant_id, 'franchise_id', v_invite.franchise_id,
    'already', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation_by_token(text, uuid) TO service_role;

COMMENT ON FUNCTION public.accept_invitation_by_token(text, uuid) IS
  'Called by the accept-invite edge function. Validates token + expiry + email match, inserts (or reuses) the user_roles row, points user_active_membership at it, and marks the invite accepted. Raises EXCEPTION with a friendly key on every failure.';
