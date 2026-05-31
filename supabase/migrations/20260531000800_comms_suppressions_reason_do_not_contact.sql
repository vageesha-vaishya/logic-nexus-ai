-- Phase 6 Step 27 — extend comms.suppressions.reason CHECK with 'do_not_contact'.
--
-- The do_not_contact bridge (Step 30) writes suppression rows when a
-- CRM user flips the do_not_contact flag on a contact or account. The
-- semantically right reason is 'do_not_contact' — not 'manual' (which
-- implies an admin one-off), not 'unsubscribe' (which is the
-- recipient acting on themselves), not 'compliance_screen' (which is
-- the gating saga). Keeping the reason distinct keeps the audit
-- trail readable and lets the suppression-management UI render the
-- right "How did this address get here?" explanation.
--
-- Additive — no existing rows have the new value, so DROP+ADD is
-- safe at any concurrency level.

ALTER TABLE comms.suppressions
  DROP CONSTRAINT IF EXISTS suppressions_reason_check;

ALTER TABLE comms.suppressions
  ADD CONSTRAINT suppressions_reason_check
  CHECK (reason = ANY (ARRAY[
    'bounce_hard',
    'bounce_soft_repeat',
    'complaint',
    'unsubscribe',
    'manual',
    'invalid_format',
    'compliance_screen',
    'do_not_contact'
  ]));
