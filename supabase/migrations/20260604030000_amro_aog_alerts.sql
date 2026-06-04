-- AOG S1 — amro.aog_alerts table + RLS + indexes.
-- Per docs/plans/2026-06-04-aog-alert-surface-design.md slice S1.
-- Smallest atomic deliverable for the AOG alert workflow that
-- hosts the AogTriagePanel.
--
-- FK targets verified against generated types:
--   public.aircraft       (NOT core.aircraft — public is canonical)
--   public.work_orders    (NOT amro_work_orders — generic platform table)
--   auth.users            (reporter + assignee + resolver)
--
-- amro schema already exists from Phase 7/8 work.

CREATE TABLE IF NOT EXISTS amro.aog_alerts (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   uuid NOT NULL,
  franchise_id                uuid,
  alert_number                text NOT NULL,
  -- Aircraft
  aircraft_id                 uuid REFERENCES public.aircraft(id),
  aircraft_registration       text,
  -- Location
  airport_iata                text NOT NULL CHECK (airport_iata ~ '^[A-Z]{3}$'),
  airport_local_time          timestamptz,
  -- Defect
  reported_at                 timestamptz NOT NULL DEFAULT now(),
  reporter_user_id            uuid REFERENCES auth.users(id),
  reporter_role               text CHECK (reporter_role IN (
    'flight_crew', 'maintenance', 'ground_ops', 'engineering', 'other'
  )),
  defect_summary              text NOT NULL CHECK (length(defect_summary) > 0),
  ata_chapter_code            text,
  severity_signal             text,
  related_warnings            jsonb NOT NULL DEFAULT '[]'::jsonb,
  mel_eligible                boolean,
  -- Lifecycle
  status                      text NOT NULL DEFAULT 'declared' CHECK (status IN (
    'declared', 'triaged', 'assigned', 'in_progress', 'resolved', 'cancelled'
  )),
  priority                    text CHECK (priority IS NULL OR priority IN (
    'P1_AOG_CRITICAL', 'P2_AOG_URGENT', 'P3_AOG_PLANNED', 'P4_DEFER_MEL'
  )),
  assigned_to                 uuid REFERENCES auth.users(id),
  estimated_recovery_hours    numeric(6,2),
  -- LLM triage output (audit trail)
  last_triage_output          jsonb,
  last_triage_invocation_id   uuid,
  last_triage_at              timestamptz,
  -- Resolution
  work_order_id               uuid REFERENCES public.work_orders(id),
  resolved_at                 timestamptz,
  resolved_by                 uuid REFERENCES auth.users(id),
  resolution_summary          text,
  -- Audit
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, alert_number)
);

COMMENT ON TABLE amro.aog_alerts IS
  'Aircraft on Ground alert workflow. Declared → triaged (via LLM '
  'amro.aog.triage) → assigned → in_progress → resolved. Precedes '
  'work-order creation; not a replacement for it. See '
  'docs/plans/2026-06-04-aog-alert-surface-design.md.';

COMMENT ON COLUMN amro.aog_alerts.related_warnings IS
  'jsonb string array of avionics warning codes from the cockpit/MX '
  'system at time of declaration. Example: ["GEAR DOORS", "L NWS"].';
COMMENT ON COLUMN amro.aog_alerts.mel_eligible IS
  'Reporter''s assessment of whether MEL deferral might apply. The '
  'LLM triage may or may not confirm; this is the input, not the verdict.';
COMMENT ON COLUMN amro.aog_alerts.last_triage_output IS
  'Verbatim parsed_output from the most recent llm-aog-triage invocation. '
  'Persisted so the operator can re-read the AI plan without re-firing '
  'the LLM. Replaced (not appended) on each re-triage.';
COMMENT ON COLUMN amro.aog_alerts.last_triage_invocation_id IS
  'Gateway invocation_id for the persisted last_triage_output. Provides '
  'a join back to gateway.invocations for cost/latency audit.';

-- ── Indexes ─────────────────────────────────────────────────────────
-- Live queue for the duty maintenance lead
CREATE INDEX IF NOT EXISTS idx_aog_alerts_queue
  ON amro.aog_alerts (tenant_id, status, reported_at DESC);

-- "What's stuck at DEL?" view
CREATE INDEX IF NOT EXISTS idx_aog_alerts_airport
  ON amro.aog_alerts (tenant_id, airport_iata, status);

-- Per-tail history
CREATE INDEX IF NOT EXISTS idx_aog_alerts_aircraft_history
  ON amro.aog_alerts (tenant_id, aircraft_id, reported_at DESC)
  WHERE aircraft_id IS NOT NULL;

-- Hot list — open alerts by registration (used by emergency panel cross-link)
CREATE INDEX IF NOT EXISTS idx_aog_alerts_active_by_reg
  ON amro.aog_alerts (aircraft_registration)
  WHERE status NOT IN ('resolved', 'cancelled');

-- GIN on related_warnings for any "find by warning code" queries
CREATE INDEX IF NOT EXISTS idx_aog_alerts_warnings_gin
  ON amro.aog_alerts USING gin (related_warnings);

-- ── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE amro.aog_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY aog_alerts_tenant_isolation ON amro.aog_alerts
  FOR ALL
  USING (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::uuid))
  WITH CHECK (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::uuid));

CREATE POLICY aog_alerts_service_bypass ON amro.aog_alerts
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON amro.aog_alerts TO authenticated;
GRANT ALL ON amro.aog_alerts TO service_role;

-- ── updated_at trigger ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION amro.tg_aog_alerts_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS aog_alerts_set_updated_at ON amro.aog_alerts;
CREATE TRIGGER aog_alerts_set_updated_at
  BEFORE UPDATE ON amro.aog_alerts
  FOR EACH ROW EXECUTE FUNCTION amro.tg_aog_alerts_set_updated_at();

-- ── alert_number sequence helper ────────────────────────────────────
-- Format: AOG-YYYY-MMDD-NNN
--   YYYY-MMDD: year + zero-padded month + day of the declaration
--   NNN:       3-digit zero-padded sequence within the tenant for that day
-- Atomic: uses a single-row UPSERT against a counter table so
-- concurrent declarations don't collide.

CREATE TABLE IF NOT EXISTS amro.aog_alert_number_counters (
  tenant_id  uuid NOT NULL,
  date_part  text NOT NULL,  -- 'YYYY-MMDD'
  next_seq   int  NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, date_part)
);

ALTER TABLE amro.aog_alert_number_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY aog_alert_counter_tenant_isolation ON amro.aog_alert_number_counters
  FOR ALL
  USING (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::uuid))
  WITH CHECK (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::uuid));

CREATE POLICY aog_alert_counter_service_bypass ON amro.aog_alert_number_counters
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON amro.aog_alert_number_counters TO authenticated;
GRANT ALL ON amro.aog_alert_number_counters TO service_role;

CREATE OR REPLACE FUNCTION amro.next_aog_alert_number(p_tenant_id uuid)
RETURNS text LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, amro AS $$
DECLARE
  v_date_part text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MMDD');
  v_seq       int;
BEGIN
  INSERT INTO amro.aog_alert_number_counters (tenant_id, date_part, next_seq)
  VALUES (p_tenant_id, v_date_part, 2)
  ON CONFLICT (tenant_id, date_part) DO UPDATE
    SET next_seq   = amro.aog_alert_number_counters.next_seq + 1,
        updated_at = now()
  RETURNING next_seq - 1 INTO v_seq;

  RETURN 'AOG-' || v_date_part || '-' || lpad(v_seq::text, 3, '0');
END $$;

COMMENT ON FUNCTION amro.next_aog_alert_number IS
  'Atomic alert number generator: AOG-YYYY-MMDD-NNN where NNN resets '
  'daily per tenant. Uses ON CONFLICT UPDATE so concurrent declarations '
  'serialise cleanly at the (tenant, date) row.';

GRANT EXECUTE ON FUNCTION amro.next_aog_alert_number(uuid) TO authenticated, service_role;

-- ── BEFORE-INSERT trigger to auto-populate alert_number ─────────────
-- Keeps client-side INSERTs simple: caller doesn't supply alert_number;
-- trigger fetches the next value if missing.

CREATE OR REPLACE FUNCTION amro.tg_aog_alerts_auto_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.alert_number IS NULL OR NEW.alert_number = '' THEN
    NEW.alert_number := amro.next_aog_alert_number(NEW.tenant_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS aog_alerts_auto_number ON amro.aog_alerts;
CREATE TRIGGER aog_alerts_auto_number
  BEFORE INSERT ON amro.aog_alerts
  FOR EACH ROW EXECUTE FUNCTION amro.tg_aog_alerts_auto_number();
