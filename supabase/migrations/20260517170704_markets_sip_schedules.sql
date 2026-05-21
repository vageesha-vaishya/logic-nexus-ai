-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260517170704; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


CREATE TABLE IF NOT EXISTS markets.sip_schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id    UUID NOT NULL REFERENCES markets.portfolios(id) ON DELETE CASCADE,
    instrument_id   UUID REFERENCES markets.instruments(id) ON DELETE SET NULL,
    scheme_code     TEXT,
    scheme_name     TEXT NOT NULL,
    amount          NUMERIC(18,4) NOT NULL CHECK (amount > 0),
    sip_day         INTEGER NOT NULL CHECK (sip_day BETWEEN 1 AND 28),
    status          TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'paused', 'cancelled')),
    last_executed_at TIMESTAMPTZ,
    execution_count  INTEGER NOT NULL DEFAULT 0,
    owner_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sip_schedules_owner_idx ON markets.sip_schedules(owner_user_id);
CREATE INDEX IF NOT EXISTS sip_schedules_portfolio_idx ON markets.sip_schedules(portfolio_id);
CREATE INDEX IF NOT EXISTS sip_schedules_status_idx ON markets.sip_schedules(status);

ALTER TABLE markets.sip_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY sip_schedules_select ON markets.sip_schedules FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY sip_schedules_insert ON markets.sip_schedules FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY sip_schedules_update ON markets.sip_schedules FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY sip_schedules_delete ON markets.sip_schedules FOR DELETE USING (auth.uid() = owner_user_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sip_schedules_updated_at') THEN
    CREATE TRIGGER sip_schedules_updated_at
      BEFORE UPDATE ON markets.sip_schedules
      FOR EACH ROW EXECUTE FUNCTION markets.set_updated_at();
  END IF;
END $$;
