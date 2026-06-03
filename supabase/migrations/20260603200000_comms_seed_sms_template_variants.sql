-- Phase 6 Comms — seed SMS template variants for the two customer-facing
-- saga chains where an SMS is genuinely useful:
--   logistics.shipment.exception — operational, time-sensitive
--   finance.invoice.overdue       — payment reminder
--
-- Quote.sent + compliance screening notifications stay email-only:
--   quote.sent.customer carries pricing in a table layout that doesn't
--     compress to 160 chars; SMS would lose detail.
--   compliance.screening.{failed,flagged} is an internal officer alert
--     that already fans out to the role's primary email.
--
-- The resolver now returns BOTH email + SMS recipients for any party
-- with phone_links → phone_numbers wired. The dispatcher's per-channel
-- INSERT into comms.deliveries means each channel gets its own row,
-- each independently rendered via the template + version below.

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
      -- ─── EMAIL variants (Phase 6 Step 12 + Step 17) ────────────────
      ('email', 'quotation.quote.sent.internal',
       'Quote sent — internal FYI',
       'FYI to the quote owner that the version is now in sent state.',
       'Quote {{quote_number}} marked as sent',
       '<p>Quote <strong>{{quote_number}}</strong> (v{{version_major}}.{{version_minor}}) was marked as sent.</p><p>Customer total: <strong>{{currency}} {{total_amount}}</strong></p><p>This is an internal notification — the customer received a separate email.</p>',
       'Quote {{quote_number}} (v{{version_major}}.{{version_minor}}) marked as sent. Total: {{currency}} {{total_amount}}.'),
      ('email', 'quotation.quote.sent.customer',
       'Quote sent — customer',
       'Notice to the customer that their quote is ready.',
       'Your quote {{quote_number}} is ready',
       '<p>Hello,</p><p>Your quote <strong>{{quote_number}}</strong> (version {{version_major}}.{{version_minor}}) is ready for review.</p><p>Total: <strong>{{currency}} {{total_amount}}</strong></p><p>Reply to this email to discuss next steps or accept the quote.</p><p style="color:#777;font-size:12px;">Sent via Logic Nexus.</p>',
       'Your quote {{quote_number}} (v{{version_major}}.{{version_minor}}) is ready. Total: {{currency}} {{total_amount}}. Reply to discuss.'),
      ('email', 'compliance.screening.failed',
       'Compliance screening failed',
       'Critical alert when a compliance screening fails — fans out to compliance_officer role.',
       'Compliance screening FAILED — {{search_name}}',
       '<p>A compliance screening has <strong>failed</strong> for {{search_name}}.</p><p>Linked entity: {{linked_entity_type}} / {{linked_entity_id}}</p><p>Match score: {{match_score}}</p><p>Notes: {{notes}}</p><p><strong>Action required:</strong> review and decide whether to block downstream actions on this entity.</p>',
       'Compliance screening FAILED — {{search_name}} (score {{match_score}}). Review required.'),
      ('email', 'compliance.screening.flagged',
       'Compliance screening flagged',
       'Warning when a compliance screening flags potential issues — fans out to compliance_officer role.',
       'Compliance screening flagged — {{search_name}}',
       '<p>A compliance screening has been <strong>flagged for review</strong> for {{search_name}}.</p><p>Linked entity: {{linked_entity_type}} / {{linked_entity_id}}</p><p>Match score: {{match_score}}</p><p>Notes: {{notes}}</p><p>Review the screening to decide pass / fail.</p>',
       'Compliance screening flagged — {{search_name}} (score {{match_score}}). Review required.'),
      ('email', 'finance.invoice.overdue',
       'Invoice overdue — dunning',
       'Reminder to the customer that an invoice is overdue.',
       'Invoice {{invoice_number}} is overdue',
       '<p>Hello,</p><p>Our records show invoice <strong>{{invoice_number}}</strong> (issued {{issue_date}}, due {{due_date}}) is now overdue.</p><p>Balance due: <strong>{{currency}} {{balance_due}}</strong> of {{currency}} {{total}}.</p><p>If this has already been paid, please share the remittance reference and we''ll reconcile straight away. Otherwise, please remit at your earliest convenience.</p><p style="color:#777;font-size:12px;">Sent via Logic Nexus.</p>',
       'Invoice {{invoice_number}} is overdue. Balance due: {{currency}} {{balance_due}}. Due date: {{due_date}}.'),
      ('email', 'logistics.shipment.exception',
       'Shipment exception',
       'Alert when a shipment status flips to exception. Customer-facing today; SMS/WhatsApp variants follow once providers are wired.',
       'Shipment {{shipment_number}} — exception flagged',
       '<p>Hello,</p><p>Shipment <strong>{{shipment_number}}</strong> ({{shipment_type}}: {{origin_country}} → {{destination_country}}) has been flagged with an exception.</p><p>Detail: {{current_status_description}}</p><p>Original ETA: {{estimated_delivery_date}}</p><p>Our team is reviewing and will follow up shortly. Reply to this email if you have specific questions.</p><p style="color:#777;font-size:12px;">Sent via Logic Nexus.</p>',
       'Shipment {{shipment_number}} ({{origin_country}}→{{destination_country}}) exception: {{current_status_description}}.'),

      -- ─── SMS variants (this slice) ────────────────────────────────
      -- Body fits in ~160 chars (standard GSM-7 segment). Subject_template
      -- is required by the schema but unused for SMS — keep it as a
      -- short label so admin UI search still finds the row.
      ('sms', 'finance.invoice.overdue',
       'Invoice overdue — SMS reminder',
       'Concise SMS reminder of an overdue invoice. Customer-facing.',
       '[SMS] Invoice {{invoice_number}} overdue',
       -- body_html_template is NOT NULL — pass empty string for SMS;
       -- the delivery-worker's SMS branch reads body_text_template only.
       '',
       'Reminder: invoice {{invoice_number}} is overdue. Balance due {{currency}} {{balance_due}}. Reply with remittance ref if paid.'),
      ('sms', 'logistics.shipment.exception',
       'Shipment exception — SMS alert',
       'Concise SMS alert when a shipment hits an exception. Customer-facing.',
       '[SMS] Shipment {{shipment_number}} exception',
       '',
       'Shipment {{shipment_number}} ({{origin_country}}->{{destination_country}}) exception: {{current_status_description}}. We are on it.')
    ) AS t(channel_kind, intent_kind, name, description, subj, html, txt)
  LOOP
    INSERT INTO comms.templates (tenant_id, channel_kind, intent_kind, name, description)
    VALUES (p_tenant_id, rec.channel_kind, rec.intent_kind, rec.name, rec.description)
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

-- Backfill: re-run for every existing tenant so the 2 SMS templates
-- land. Idempotent — ON CONFLICT skips already-seeded rows so the
-- 96 email templates we already have are untouched.
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
