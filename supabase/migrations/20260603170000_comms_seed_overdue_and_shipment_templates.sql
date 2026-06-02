-- Phase 6 Comms — seed finance.invoice.overdue + logistics.shipment.exception templates.
--
-- The Step 53 + Step 54 emitter migrations already land their own
-- subject/html into core.notifications.payload, so the delivery-worker
-- ships *something* even without a per-tenant template. But the
-- master-plan §10 acceptance for cross-module sagas requires editable
-- templates so operators can tune voice + branding without code
-- changes. This migration extends comms.provision_default_templates()
-- with the two new intent kinds AND backfills the existing tenants.
--
-- Variables follow the payload shape the emitters write:
--   finance.invoice.overdue: invoice_number, currency, balance_due,
--                            total, due_date, issue_date
--   logistics.shipment.exception: shipment_number, shipment_type,
--                                 origin_country, destination_country,
--                                 estimated_delivery_date,
--                                 current_status_description

CREATE OR REPLACE FUNCTION comms.provision_default_templates(p_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = comms, public
AS $function$
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
        '<p>Quote <strong>{{quote_number}}</strong> (v{{version_major}}.{{version_minor}}) was marked as sent.</p><p>Customer total: <strong>{{currency}} {{total_amount}}</strong></p><p>This is an internal notification — the customer received a separate email.</p>',
        'Quote {{quote_number}} (v{{version_major}}.{{version_minor}}) marked as sent. Total: {{currency}} {{total_amount}}.'
      ),
      (
        'quotation.quote.sent.customer',
        'Quote sent — customer',
        'Notice to the customer that their quote is ready.',
        'Your quote {{quote_number}} is ready',
        '<p>Hello,</p><p>Your quote <strong>{{quote_number}}</strong> (version {{version_major}}.{{version_minor}}) is ready for review.</p><p>Total: <strong>{{currency}} {{total_amount}}</strong></p><p>Reply to this email to discuss next steps or accept the quote.</p><p style="color:#777;font-size:12px;">Sent via Logic Nexus.</p>',
        'Your quote {{quote_number}} (v{{version_major}}.{{version_minor}}) is ready. Total: {{currency}} {{total_amount}}. Reply to discuss.'
      ),
      (
        'compliance.screening.failed',
        'Compliance screening failed',
        'Critical alert when a compliance screening fails — fans out to compliance_officer role.',
        'Compliance screening FAILED — {{search_name}}',
        '<p>A compliance screening has <strong>failed</strong> for {{search_name}}.</p><p>Linked entity: {{linked_entity_type}} / {{linked_entity_id}}</p><p>Match score: {{match_score}}</p><p>Notes: {{notes}}</p><p><strong>Action required:</strong> review and decide whether to block downstream actions on this entity.</p>',
        'Compliance screening FAILED — {{search_name}} (score {{match_score}}). Review required.'
      ),
      (
        'compliance.screening.flagged',
        'Compliance screening flagged',
        'Warning when a compliance screening flags potential issues — fans out to compliance_officer role.',
        'Compliance screening flagged — {{search_name}}',
        '<p>A compliance screening has been <strong>flagged for review</strong> for {{search_name}}.</p><p>Linked entity: {{linked_entity_type}} / {{linked_entity_id}}</p><p>Match score: {{match_score}}</p><p>Notes: {{notes}}</p><p>Review the screening to decide pass / fail.</p>',
        'Compliance screening flagged — {{search_name}} (score {{match_score}}). Review required.'
      ),
      (
        'finance.invoice.overdue',
        'Invoice overdue — dunning',
        'Reminder to the customer that an invoice is overdue.',
        'Invoice {{invoice_number}} is overdue',
        '<p>Hello,</p><p>Our records show invoice <strong>{{invoice_number}}</strong> (issued {{issue_date}}, due {{due_date}}) is now overdue.</p><p>Balance due: <strong>{{currency}} {{balance_due}}</strong> of {{currency}} {{total}}.</p><p>If this has already been paid, please share the remittance reference and we''ll reconcile straight away. Otherwise, please remit at your earliest convenience.</p><p style="color:#777;font-size:12px;">Sent via Logic Nexus.</p>',
        'Invoice {{invoice_number}} is overdue. Balance due: {{currency}} {{balance_due}}. Due date: {{due_date}}.'
      ),
      (
        'logistics.shipment.exception',
        'Shipment exception',
        'Alert when a shipment status flips to exception. Customer-facing today; SMS/WhatsApp variants follow once providers are wired.',
        'Shipment {{shipment_number}} — exception flagged',
        '<p>Hello,</p><p>Shipment <strong>{{shipment_number}}</strong> ({{shipment_type}}: {{origin_country}} → {{destination_country}}) has been flagged with an exception.</p><p>Detail: {{current_status_description}}</p><p>Original ETA: {{estimated_delivery_date}}</p><p>Our team is reviewing and will follow up shortly. Reply to this email if you have specific questions.</p><p style="color:#777;font-size:12px;">Sent via Logic Nexus.</p>',
        'Shipment {{shipment_number}} ({{origin_country}}→{{destination_country}}) exception: {{current_status_description}}.'
      )
    ) AS t(intent_kind, name, description, subj, html, txt)
  LOOP
    INSERT INTO comms.templates (tenant_id, channel_kind, intent_kind, name, description)
    VALUES (p_tenant_id, 'email', rec.intent_kind, rec.name, rec.description)
    ON CONFLICT (tenant_id, channel_kind, intent_kind, language) DO NOTHING
    RETURNING id INTO tpl_id;
    IF tpl_id IS NULL THEN CONTINUE; END IF;
    INSERT INTO comms.template_versions (
      tenant_id, template_id, version_number,
      subject_template, body_html_template, body_text_template, active_at
    ) VALUES (p_tenant_id, tpl_id, 1, rec.subj, rec.html, rec.txt, now())
    RETURNING id INTO ver_id;
    UPDATE comms.templates SET current_version_id = ver_id, updated_at = now() WHERE id = tpl_id;
    rows_seeded := rows_seeded + 1;
  END LOOP;
  RETURN rows_seeded;
END;
$function$;

COMMENT ON FUNCTION comms.provision_default_templates(uuid) IS
  'Phase 6 Comms: provisions the canonical comms.templates set for a tenant. Idempotent (ON CONFLICT DO NOTHING). Auto-runs on tenant creation via trg_provision_tenant_templates; can also be called manually to backfill new intent kinds on existing tenants.';

-- Backfill: re-run for every existing tenant so the two new intents land.
DO $backfill$
DECLARE
  t RECORD;
  total_seeded int := 0;
  per_tenant   int;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    per_tenant := comms.provision_default_templates(t.id);
    total_seeded := total_seeded + per_tenant;
  END LOOP;
  RAISE NOTICE 'comms.provision_default_templates backfill: % new template rows across all tenants', total_seeded;
END
$backfill$;
