-- Phase 4 CRM Step 4 — crm.campaigns + crm.campaign_members
-- Per docs/plans/2026-05-28-platform-modules-redesign.md §7.4 Phase 4
--
-- No source table existed. src/pages/dashboard/Campaigns.tsx is a
-- placeholder ("Coming Soon"). This migration creates the data layer so
-- the next slice can wire the page to a real read/write surface.
--
-- Tables created:
--   - crm.campaigns          — campaign master (name, channel, status, budget, metrics)
--   - crm.campaign_members   — m:n party ↔ campaign with member-state log
--
-- Both keyed under crm.* per Phase 4 namespacing. campaign_members.party_id
-- references core.parties(id) so audience can include both organizations
-- (accounts) and people (contacts) without polymorphic gymnastics — the
-- party_type column on core.parties already discriminates.

-- ══════════════════════════════════════════════════════════════════════
-- 1. crm.campaigns
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE crm.campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  franchise_id    uuid,
  name            text NOT NULL,
  description     text,
  -- channel: which surface the campaign runs on. text rather than enum
  -- to keep cross-schema additions cheap (a new channel doesn't require
  -- a coordinated ALTER TYPE migration).
  channel         text NOT NULL CHECK (channel IN (
                    'email','sms','whatsapp','push','social','phone','multi','other'
                  )),
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN (
                    'draft','scheduled','active','paused','completed','archived'
                  )),
  -- Scheduling
  start_at        timestamptz,
  end_at          timestamptz,
  -- Targeting: jsonb segment definition (filter DSL TBD per consumer).
  target_audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_count    integer NOT NULL DEFAULT 0,
  -- Financials
  budget          numeric(14,2),
  currency        text DEFAULT 'INR',
  spend_to_date   numeric(14,2) NOT NULL DEFAULT 0,
  -- Funnel metrics — incremented by the messaging / analytics workers.
  -- Kept as integers (not computed views) so the dashboard can read
  -- aggregate counts without scanning the member table.
  sent_count      integer NOT NULL DEFAULT 0,
  delivered_count integer NOT NULL DEFAULT 0,
  opened_count    integer NOT NULL DEFAULT 0,
  clicked_count   integer NOT NULL DEFAULT 0,
  converted_count integer NOT NULL DEFAULT 0,
  -- Ownership
  owner_id        uuid,
  created_by      uuid,
  -- Misc
  tags            text[] NOT NULL DEFAULT '{}',
  custom_fields   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at IS NULL OR start_at IS NULL OR end_at >= start_at)
);

COMMENT ON TABLE crm.campaigns IS
  'Phase 4 CRM Step 4 — campaign master. New table; Campaigns page wires up to this in the next slice.';

CREATE INDEX campaigns_tenant_status_idx ON crm.campaigns (tenant_id, status, start_at DESC NULLS LAST);
CREATE INDEX campaigns_owner_idx         ON crm.campaigns (owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX campaigns_active_idx        ON crm.campaigns (tenant_id, start_at) WHERE status = 'active';

ALTER TABLE crm.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaigns_tenant_select ON crm.campaigns
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE POLICY campaigns_tenant_insert ON crm.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE POLICY campaigns_tenant_update ON crm.campaigns
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())))
  WITH CHECK (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE POLICY campaigns_tenant_delete ON crm.campaigns
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_crm_campaigns_updated_at
  BEFORE UPDATE ON crm.campaigns
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON crm.campaigns TO authenticated;
GRANT ALL ON crm.campaigns TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 2. crm.campaign_members — m:n party ↔ campaign
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE crm.campaign_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  campaign_id     uuid NOT NULL REFERENCES crm.campaigns(id) ON DELETE CASCADE,
  -- party_id covers both organizations and people via core.parties.
  -- Audience-of-organizations vs audience-of-people is discriminated by
  -- the party_type column readers JOIN through.
  party_id        uuid NOT NULL REFERENCES core.parties(id) ON DELETE CASCADE,
  -- Member-level funnel state. Mirrors the campaign-level counters but
  -- pinned to a specific party so per-recipient progress is queryable.
  status          text NOT NULL DEFAULT 'added' CHECK (status IN (
                    'added','queued','sent','delivered','opened','clicked','responded','converted','bounced','opted_out','failed'
                  )),
  -- Per-touchpoint timestamps. Kept as scalars (vs an events table) so
  -- the per-campaign dashboard can SELECT … WHERE opened_at IS NOT NULL
  -- without an extra JOIN. The full audit chain still lives in
  -- core.audit_log + crm.activities for per-message detail.
  added_at        timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  delivered_at    timestamptz,
  opened_at       timestamptz,
  clicked_at      timestamptz,
  responded_at    timestamptz,
  converted_at    timestamptz,
  opted_out_at    timestamptz,
  -- Last messaging error from the provider, if any. Lets the UI surface
  -- "delivery failed: invalid recipient" without a join into core.audit_log.
  last_error      text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, party_id)
);

COMMENT ON TABLE crm.campaign_members IS
  'Phase 4 CRM Step 4 — m:n party ↔ campaign with per-recipient funnel state.';

CREATE INDEX campaign_members_campaign_status_idx ON crm.campaign_members (campaign_id, status);
CREATE INDEX campaign_members_party_idx           ON crm.campaign_members (party_id);
CREATE INDEX campaign_members_tenant_idx          ON crm.campaign_members (tenant_id, campaign_id);

ALTER TABLE crm.campaign_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaign_members_tenant_select ON crm.campaign_members
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE POLICY campaign_members_tenant_insert ON crm.campaign_members
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE POLICY campaign_members_tenant_update ON crm.campaign_members
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())))
  WITH CHECK (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE POLICY campaign_members_tenant_delete ON crm.campaign_members
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_crm_campaign_members_updated_at
  BEFORE UPDATE ON crm.campaign_members
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON crm.campaign_members TO authenticated;
GRANT ALL ON crm.campaign_members TO service_role;
