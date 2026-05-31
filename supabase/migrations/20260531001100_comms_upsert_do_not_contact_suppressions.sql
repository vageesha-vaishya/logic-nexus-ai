-- Phase 6 Step 30a — comms.upsert_do_not_contact_suppressions RPC.
--
-- Consumer-side decision engine for the CRM → comms suppression
-- bridge. Mirrors the Step 22a / compliance.screen_subject pattern:
-- the consumer TS shrinks to "poll → for each event call this rpc →
-- mark outbox published", and the actual address-resolution +
-- suppression-upsert work happens in one Postgres transaction here.
--
-- Resolution chain:
--   party_id → core.email_links (subject_type='core.party')
--           → core.email_addresses (the actual address)
--           → comms.suppressions (channel_kind='email')
--   party_id → core.phone_links (subject_type='core.party')
--           → core.phone_numbers (E.164)
--           → comms.suppressions (channel_kind='sms')
--
-- The phone→sms mapping is the conservative default: comms.suppressions
-- has separate channel_kind values for sms/whatsapp/push, but a phone
-- number alone doesn't tell us which channels the recipient is reachable
-- on. SMS is the always-on baseline; per-channel suppression for
-- whatsapp/push will key off explicit channel_account attachments in
-- a future slice.
--
-- ON CONFLICT (tenant_id, channel_kind, address) DO NOTHING — if the
-- address is ALREADY suppressed (bounce_hard, complaint, unsubscribe,
-- whatever) we don't overwrite. The original reason wins for audit
-- purposes; the end state (suppressed) is the same.
--
-- source_metadata carries party_id, party_kind, source_outbox_id so the
-- suppression-management UI can render "Suppressed because party X
-- (account/contact) was marked do-not-contact via outbox event Y" and
-- the operator can trace the chain back.

CREATE OR REPLACE FUNCTION comms.upsert_do_not_contact_suppressions(
  p_tenant_id        uuid,
  p_party_id         uuid,
  p_party_kind       text,
  p_source_outbox_id uuid
) RETURNS TABLE (
  inserted_count integer,
  email_count    integer,
  phone_count    integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = comms, core, pg_catalog
AS $$
DECLARE
  v_email_inserted integer := 0;
  v_phone_inserted integer := 0;
  v_meta jsonb;
BEGIN
  v_meta := jsonb_build_object(
    'party_id',          p_party_id,
    'party_kind',        p_party_kind,
    'source_outbox_id',  p_source_outbox_id::text,
    'source_event_type', 'crm.do_not_contact.set'
  );

  -- Email addresses linked to the party.
  WITH ins_email AS (
    INSERT INTO comms.suppressions (
      tenant_id, channel_kind, address, reason,
      source_event_id, source_metadata, added_by_kind
    )
    SELECT DISTINCT
      p_tenant_id,
      'email',
      lower(trim(ea.email)),
      'do_not_contact',
      p_source_outbox_id,
      v_meta,
      'system'
    FROM core.email_links el
    JOIN core.email_addresses ea ON ea.id = el.email_id
    WHERE el.tenant_id = p_tenant_id
      AND el.subject_type = 'core.party'
      AND el.subject_id = p_party_id
      AND ea.email IS NOT NULL
      AND length(trim(ea.email)) > 0
    ON CONFLICT (tenant_id, channel_kind, address) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_email_inserted FROM ins_email;

  -- Phone numbers linked to the party. E.164 → SMS channel (the
  -- always-on baseline; see fn header for the per-channel design note).
  WITH ins_phone AS (
    INSERT INTO comms.suppressions (
      tenant_id, channel_kind, address, reason,
      source_event_id, source_metadata, added_by_kind
    )
    SELECT DISTINCT
      p_tenant_id,
      'sms',
      pn.e164,
      'do_not_contact',
      p_source_outbox_id,
      v_meta,
      'system'
    FROM core.phone_links pl
    JOIN core.phone_numbers pn ON pn.id = pl.phone_id
    WHERE pl.tenant_id = p_tenant_id
      AND pl.subject_type = 'core.party'
      AND pl.subject_id = p_party_id
      AND pn.e164 IS NOT NULL
      AND length(trim(pn.e164)) > 0
    ON CONFLICT (tenant_id, channel_kind, address) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_phone_inserted FROM ins_phone;

  RETURN QUERY
    SELECT (v_email_inserted + v_phone_inserted), v_email_inserted, v_phone_inserted;
END;
$$;

COMMENT ON FUNCTION comms.upsert_do_not_contact_suppressions(uuid, uuid, text, uuid) IS
  'Phase 6 Step 30a — CRM → comms suppression bridge consumer-side. Resolves all email + phone addresses linked to a party and upserts comms.suppressions rows with reason=do_not_contact. Called once per crm.do_not_contact.set outbox event by the comms-api do-not-contact consumer.';

-- Lock down: only the service-role-backed consumer should call this.
-- Pre-emptive — Step 24's lesson learned: GRANT TO service_role is
-- additive over the PUBLIC default; need explicit REVOKEs.
REVOKE EXECUTE ON FUNCTION comms.upsert_do_not_contact_suppressions(uuid, uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION comms.upsert_do_not_contact_suppressions(uuid, uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION comms.upsert_do_not_contact_suppressions(uuid, uuid, text, uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION comms.upsert_do_not_contact_suppressions(uuid, uuid, text, uuid) TO service_role;
