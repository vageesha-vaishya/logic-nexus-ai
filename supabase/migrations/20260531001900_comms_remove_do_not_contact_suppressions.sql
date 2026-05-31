-- Phase 6 Step 43a — comms.remove_do_not_contact_suppressions RPC.
--
-- Consumer-side companion to Step 30a's upsert RPC. When the CRM
-- user flips do_not_contact back to false, the comms-api consumer
-- calls this fn to undo only the suppressions THIS party created
-- via the do_not_contact path — never touches rows added by
-- bounce_hard, complaint, unsubscribe, manual, etc.
--
-- The filter is reason='do_not_contact' AND
-- (source_metadata->>'party_id') = p_party_id::text. The party_id
-- match is the safety belt — if another party shares an address
-- with this one and both were marked do_not_contact independently,
-- only the row tied to THIS party gets removed; the other party's
-- suppression on the same address survives. (The address can still
-- be suppressed via the other party's row; isSuppressed() doesn't
-- need to know which one.)
--
-- Returns (deleted_count, email_count, phone_count) matching the
-- shape of the upsert RPC for consistency in the consumer's log
-- output.

CREATE OR REPLACE FUNCTION comms.remove_do_not_contact_suppressions(
  p_tenant_id        uuid,
  p_party_id         uuid,
  p_party_kind       text,
  p_source_outbox_id uuid
) RETURNS TABLE (
  deleted_count integer,
  email_count   integer,
  phone_count   integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = comms, core, pg_catalog
AS $$
DECLARE
  v_email_deleted integer := 0;
  v_phone_deleted integer := 0;
BEGIN
  WITH del_email AS (
    DELETE FROM comms.suppressions s
    WHERE s.tenant_id    = p_tenant_id
      AND s.reason       = 'do_not_contact'
      AND s.channel_kind = 'email'
      AND (s.source_metadata->>'party_id') = p_party_id::text
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_email_deleted FROM del_email;

  WITH del_phone AS (
    DELETE FROM comms.suppressions s
    WHERE s.tenant_id    = p_tenant_id
      AND s.reason       = 'do_not_contact'
      AND s.channel_kind = 'sms'
      AND (s.source_metadata->>'party_id') = p_party_id::text
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_phone_deleted FROM del_phone;

  -- p_party_kind + p_source_outbox_id are accepted for symmetry with
  -- the upsert RPC + future audit hooks; not currently used in the
  -- delete predicate. Keeping the signatures aligned makes the
  -- consumer's branch trivial.
  PERFORM p_party_kind, p_source_outbox_id;

  RETURN QUERY
    SELECT (v_email_deleted + v_phone_deleted), v_email_deleted, v_phone_deleted;
END;
$$;

COMMENT ON FUNCTION comms.remove_do_not_contact_suppressions(uuid, uuid, text, uuid) IS
  'Phase 6 Step 43a — undo the comms.suppressions rows created by the do_not_contact bridge for a given party. Only touches reason=do_not_contact rows linked to the party; bounce/complaint/unsubscribe/manual rows survive.';

REVOKE EXECUTE ON FUNCTION comms.remove_do_not_contact_suppressions(uuid, uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION comms.remove_do_not_contact_suppressions(uuid, uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION comms.remove_do_not_contact_suppressions(uuid, uuid, text, uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION comms.remove_do_not_contact_suppressions(uuid, uuid, text, uuid) TO service_role;
