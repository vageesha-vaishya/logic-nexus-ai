-- Phase 1 Slice C UI cutover — replace the `!account.access_token` check
-- in src/components/email/EmailAccounts.tsx with an RPC that reads from
-- core.secrets instead of the soon-to-be-NULL access_token column.
--
-- The RPC takes NO arguments and returns the subset of the calling user's
-- own email_accounts that have an active core.secrets row of purpose
-- 'oauth_access_token'. Ownership is enforced inside the function via
-- email_accounts.user_id = auth.uid(), so a malicious caller can't probe
-- accounts they don't own (core.secrets's tenant-admin-only RLS would
-- already block direct reads, but this gives every authenticated user
-- a safe, owner-scoped path).
--
-- Used by the EmailAccounts settings page to show / hide the
-- "Re-authorize" button. Once the NULL-out migration 20260528260000
-- applies on prod, the access_token column will be NULL on every row;
-- without this RPC the UI would show "Re-authorize" for every account.

CREATE OR REPLACE FUNCTION core.my_oauth_connected_email_accounts()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
  SELECT ea.id
  FROM   public.email_accounts ea
  JOIN   core.secrets s
        ON s.subject_kind = 'comms.email_account'
       AND s.subject_id   = ea.id
       AND s.purpose      = 'oauth_access_token'
       AND s.is_active    = true
  WHERE  ea.user_id = auth.uid();
$$;

COMMENT ON FUNCTION core.my_oauth_connected_email_accounts IS
  'Returns the subset of the calling user''s email_accounts that have an active oauth_access_token in core.secrets. Used by EmailAccounts.tsx after the access_token column is NULLed (Phase 1 Slice C, migration 20260528260000).';

GRANT EXECUTE ON FUNCTION core.my_oauth_connected_email_accounts()
  TO authenticated;
