-- Phase 6 Step 12 — seed canonical templates for the two live intents.
-- The DB trigger emit_quotation_quote_sent_intent emits:
--   quotation.quote.sent.internal  → operator FYI
--   quotation.quote.sent.customer  → customer notice
--
-- Until templates exist for these, the delivery-worker falls back to
-- the trigger-supplied payload.subject/html. Seeding here makes the
-- emails operator-controlled and version-pinned. RLS lets tenant admins
-- override per tenant (no platform-wide row created here — these are
-- per-tenant rows seeded for every existing tenant).
--
-- Idempotency: ON CONFLICT (tenant_id, channel_kind, intent_kind,
-- language) DO NOTHING. Re-running the migration is a no-op.

DO $$
DECLARE
  rec RECORD;
  tpl_internal_id uuid;
  tpl_customer_id uuid;
  ver_internal_id uuid;
  ver_customer_id uuid;
BEGIN
  FOR rec IN
    SELECT id AS tenant_id FROM public.tenants
  LOOP
    -- ── Internal FYI ────────────────────────────────────────────────
    INSERT INTO comms.templates (tenant_id, channel_kind, intent_kind, name, description)
    VALUES (
      rec.tenant_id, 'email', 'quotation.quote.sent.internal',
      'Quote sent — internal FYI',
      'FYI to the quote owner that the version is now in sent state.'
    )
    ON CONFLICT (tenant_id, channel_kind, intent_kind, language) DO NOTHING
    RETURNING id INTO tpl_internal_id;

    IF tpl_internal_id IS NOT NULL THEN
      INSERT INTO comms.template_versions (
        tenant_id, template_id, version_number,
        subject_template, body_html_template, body_text_template, active_at
      ) VALUES (
        rec.tenant_id, tpl_internal_id, 1,
        'Quote {{quote_number}} marked as sent',
        '<p>Quote <strong>{{quote_number}}</strong> (v{{version_major}}.{{version_minor}}) was marked as sent.</p>'
        || '<p>Customer total: <strong>{{currency}} {{total_amount}}</strong></p>'
        || '<p>This is an internal notification — the customer received a separate email.</p>',
        'Quote {{quote_number}} (v{{version_major}}.{{version_minor}}) marked as sent. Total: {{currency}} {{total_amount}}.',
        now()
      )
      RETURNING id INTO ver_internal_id;

      UPDATE comms.templates SET current_version_id = ver_internal_id, updated_at = now()
      WHERE id = tpl_internal_id;
    END IF;

    -- ── Customer-facing ─────────────────────────────────────────────
    INSERT INTO comms.templates (tenant_id, channel_kind, intent_kind, name, description)
    VALUES (
      rec.tenant_id, 'email', 'quotation.quote.sent.customer',
      'Quote sent — customer',
      'Notice to the customer that their quote is ready.'
    )
    ON CONFLICT (tenant_id, channel_kind, intent_kind, language) DO NOTHING
    RETURNING id INTO tpl_customer_id;

    IF tpl_customer_id IS NOT NULL THEN
      INSERT INTO comms.template_versions (
        tenant_id, template_id, version_number,
        subject_template, body_html_template, body_text_template, active_at
      ) VALUES (
        rec.tenant_id, tpl_customer_id, 1,
        'Your quote {{quote_number}} is ready',
        '<p>Hello,</p>'
        || '<p>Your quote <strong>{{quote_number}}</strong> (version {{version_major}}.{{version_minor}}) is ready for review.</p>'
        || '<p>Total: <strong>{{currency}} {{total_amount}}</strong></p>'
        || '<p>Reply to this email to discuss next steps or accept the quote.</p>'
        || '<p style="color:#777;font-size:12px;">Sent via Logic Nexus.</p>',
        'Your quote {{quote_number}} (v{{version_major}}.{{version_minor}}) is ready. Total: {{currency}} {{total_amount}}. Reply to discuss.',
        now()
      )
      RETURNING id INTO ver_customer_id;

      UPDATE comms.templates SET current_version_id = ver_customer_id, updated_at = now()
      WHERE id = tpl_customer_id;
    END IF;
  END LOOP;
END $$;
