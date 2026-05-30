-- Phase 6 Step 15 — auto-provision canonical templates on new tenants.
--
-- The Step 12 backfill seeded templates for the 16 existing tenants but
-- a new tenant created tomorrow would land with zero templates →
-- delivery-worker falls back to payload.subject/html for every send.
--
-- Pulls the seeding logic into comms.provision_default_templates(tenant_id),
-- callable from:
--   * a trigger on public.tenants AFTER INSERT (this slice)
--   * the original Step 12 backfill (idempotent re-run)
--   * an admin RPC for re-provisioning (future)
--
-- Adding a new canonical template = add a single (intent_kind, subject,
-- body) row to the function. All tenants get it on next provisioner call.

CREATE OR REPLACE FUNCTION comms.provision_default_templates(p_tenant_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = comms, public
AS $$
DECLARE
  rec RECORD;
  tpl_id uuid;
  ver_id uuid;
  rows_seeded int := 0;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      (
        'quotation.quote.sent.internal',
        'Quote sent — internal FYI',
        'FYI to the quote owner that the version is now in sent state.',
        'Quote {{quote_number}} marked as sent',
        '<p>Quote <strong>{{quote_number}}</strong> (v{{version_major}}.{{version_minor}}) was marked as sent.</p>'
        || '<p>Customer total: <strong>{{currency}} {{total_amount}}</strong></p>'
        || '<p>This is an internal notification — the customer received a separate email.</p>',
        'Quote {{quote_number}} (v{{version_major}}.{{version_minor}}) marked as sent. Total: {{currency}} {{total_amount}}.'
      ),
      (
        'quotation.quote.sent.customer',
        'Quote sent — customer',
        'Notice to the customer that their quote is ready.',
        'Your quote {{quote_number}} is ready',
        '<p>Hello,</p>'
        || '<p>Your quote <strong>{{quote_number}}</strong> (version {{version_major}}.{{version_minor}}) is ready for review.</p>'
        || '<p>Total: <strong>{{currency}} {{total_amount}}</strong></p>'
        || '<p>Reply to this email to discuss next steps or accept the quote.</p>'
        || '<p style="color:#777;font-size:12px;">Sent via Logic Nexus.</p>',
        'Your quote {{quote_number}} (v{{version_major}}.{{version_minor}}) is ready. Total: {{currency}} {{total_amount}}. Reply to discuss.'
      ),
      (
        'compliance.screening.failed',
        'Compliance screening failed',
        'Critical alert when a compliance screening fails — fans out to compliance_officer role.',
        'Compliance screening FAILED — {{search_name}}',
        '<p>A compliance screening has <strong>failed</strong> for {{search_name}}.</p>'
        || '<p>Linked entity: {{linked_entity_type}} / {{linked_entity_id}}</p>'
        || '<p>Match score: {{match_score}}</p>'
        || '<p>Notes: {{notes}}</p>'
        || '<p><strong>Action required:</strong> review and decide whether to block downstream actions on this entity.</p>',
        'Compliance screening FAILED — {{search_name}} (score {{match_score}}). Review required.'
      ),
      (
        'compliance.screening.flagged',
        'Compliance screening flagged',
        'Warning when a compliance screening flags potential issues — fans out to compliance_officer role.',
        'Compliance screening flagged — {{search_name}}',
        '<p>A compliance screening has been <strong>flagged for review</strong> for {{search_name}}.</p>'
        || '<p>Linked entity: {{linked_entity_type}} / {{linked_entity_id}}</p>'
        || '<p>Match score: {{match_score}}</p>'
        || '<p>Notes: {{notes}}</p>'
        || '<p>Review the screening to decide pass / fail.</p>',
        'Compliance screening flagged — {{search_name}} (score {{match_score}}). Review required.'
      )
    ) AS t(intent_kind, name, description, subj, html, txt)
  LOOP
    INSERT INTO comms.templates (tenant_id, channel_kind, intent_kind, name, description)
    VALUES (p_tenant_id, 'email', rec.intent_kind, rec.name, rec.description)
    ON CONFLICT (tenant_id, channel_kind, intent_kind, language) DO NOTHING
    RETURNING id INTO tpl_id;

    -- Skip when conflict — the version pin already exists.
    IF tpl_id IS NULL THEN CONTINUE; END IF;

    INSERT INTO comms.template_versions (
      tenant_id, template_id, version_number,
      subject_template, body_html_template, body_text_template, active_at
    ) VALUES (
      p_tenant_id, tpl_id, 1, rec.subj, rec.html, rec.txt, now()
    )
    RETURNING id INTO ver_id;

    UPDATE comms.templates SET current_version_id = ver_id, updated_at = now()
    WHERE id = tpl_id;

    rows_seeded := rows_seeded + 1;
  END LOOP;

  RETURN rows_seeded;
END;
$$;

COMMENT ON FUNCTION comms.provision_default_templates(uuid) IS
  'Phase 6 Step 15 — seed canonical comms templates for a tenant. Idempotent: ON CONFLICT on (tenant_id, channel_kind, intent_kind, language) DO NOTHING. Returns number of new rows.';

-- Fill any gaps on existing tenants (e.g., the new compliance.* templates).
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    PERFORM comms.provision_default_templates(t.id);
  END LOOP;
END $$;

-- Forward provisioner — every new tenant inherits the defaults.
CREATE OR REPLACE FUNCTION public.provision_tenant_default_templates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM comms.provision_default_templates(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't block tenant creation on a template-seed failure; just log.
  RAISE WARNING 'provision_tenant_default_templates(tenant=%) failed: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_provision_tenant_templates ON public.tenants;
CREATE TRIGGER trg_provision_tenant_templates
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.provision_tenant_default_templates();
