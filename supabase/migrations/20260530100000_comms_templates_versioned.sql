-- Phase 6 Step 11 — versioned comms templates.
-- Per docs/plans/2026-05-28-modules/comms.md §3 (template_versions
-- model). The existing comms.email_templates is a flat mirror from
-- public.email_templates (Phase 6 Step 1) and stays for the ad-hoc
-- editor UI; intent-driven sends move to this versioned model.
--
-- Schema:
--   comms.templates              one row per logical template; carries
--                                current_version_id as the mutable
--                                pointer producers reference.
--   comms.template_versions      immutable per-version rows; sent
--                                messages record template_version_id
--                                so the audit trail is reproducible.
--
-- comms.deliveries gains template_version_id so each delivery is tied
-- to the exact version that produced it.
--
-- Render: simple {{var}} substitution in the worker (no Handlebars
-- loops/conditionals for this slice — keep deterministic). HTML
-- substitutions auto-escape unless the variable name ends in `_raw`.

CREATE TABLE IF NOT EXISTS comms.templates (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid         NOT NULL,
  channel_kind        text         NOT NULL,                              -- 'email','sms','whatsapp',...
  intent_kind         text         NOT NULL,                              -- 'quotation.quote.sent.customer', etc.
  name                text         NOT NULL,
  description         text,
  current_version_id  uuid,                                               -- FK added after template_versions
  variables_schema    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  language            text         NOT NULL DEFAULT 'en',
  is_active           boolean      NOT NULL DEFAULT true,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, channel_kind, intent_kind, language)
);

CREATE TABLE IF NOT EXISTS comms.template_versions (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid        NOT NULL,
  template_id              uuid        NOT NULL REFERENCES comms.templates(id) ON DELETE CASCADE,
  version_number           int         NOT NULL,
  subject_template         text        NOT NULL,
  body_html_template       text        NOT NULL,
  body_text_template       text,
  variables_schema         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  created_by               uuid,
  active_at                timestamptz,
  deprecated_at            timestamptz,
  UNIQUE (template_id, version_number)
);

ALTER TABLE comms.templates
  ADD CONSTRAINT templates_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES comms.template_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS templates_intent_lookup_idx
  ON comms.templates (tenant_id, intent_kind, channel_kind, language)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS template_versions_template_idx
  ON comms.template_versions (template_id, version_number DESC);

-- Audit trail on the send side.
ALTER TABLE comms.deliveries
  ADD COLUMN IF NOT EXISTS template_version_id uuid REFERENCES comms.template_versions(id);

CREATE INDEX IF NOT EXISTS deliveries_template_version_idx
  ON comms.deliveries (template_version_id)
  WHERE template_version_id IS NOT NULL;

COMMENT ON TABLE comms.templates IS
  'Phase 6 Step 11 — logical template per (tenant, channel, intent, language). current_version_id is the producer pointer; sends snapshot template_version_id on the delivery row.';
COMMENT ON TABLE comms.template_versions IS
  'Phase 6 Step 11 — immutable rendered template versions. Newer rows supersede; comms.deliveries.template_version_id pins the audit trail.';

-- RLS — tenant read, role-gated write. Service role bypasses regardless.
ALTER TABLE comms.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE comms.template_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS templates_tenant_select ON comms.templates;
CREATE POLICY templates_tenant_select ON comms.templates FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

DROP POLICY IF EXISTS template_versions_tenant_select ON comms.template_versions;
CREATE POLICY template_versions_tenant_select ON comms.template_versions FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

GRANT SELECT ON comms.templates, comms.template_versions TO authenticated;
GRANT ALL ON comms.templates, comms.template_versions TO service_role;
