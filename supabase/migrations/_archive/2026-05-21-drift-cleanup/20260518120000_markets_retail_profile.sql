-- Retail investment foundation: per-user risk profile + 3-tier portfolio mapping.
--
-- risk_profiles  — onboarding output (experience, risk tag, goals, behavioural
--                  flags, raw quiz answers). One row per user.
-- portfolio_tiers — links the existing markets.portfolios rows to one of three
--                   tier slots: Safety Net (1) / Core Portfolio (2) /
--                   Experimental (3). One row per (user, tier_number).

-- ── Risk Profiles ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS markets.risk_profiles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  experience_level    text NOT NULL
                      CHECK (experience_level IN ('beginner', 'casual', 'self_directed')),
  risk_tag            text NOT NULL
                      CHECK (risk_tag IN ('conservative', 'moderate', 'aggressive')),
  goals               jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{goal, years, target_amount?}, ...]
  behavioral_flags    jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {tends_panic_sell: bool, ...}
  quiz_answers        jsonb NOT NULL DEFAULT '{}'::jsonb,   -- raw quiz responses (audit trail)
  onboarding_complete boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_risk_profile_user UNIQUE (user_id)
);

ALTER TABLE markets.risk_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'markets' AND tablename = 'risk_profiles'
      AND policyname = 'Users manage own risk profile'
  ) THEN
    CREATE POLICY "Users manage own risk profile"
      ON markets.risk_profiles
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

-- ── Portfolio Tiers ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS markets.portfolio_tiers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_number     int  NOT NULL CHECK (tier_number IN (1, 2, 3)),
  name            text NOT NULL,
  portfolio_id    uuid REFERENCES markets.portfolios(id) ON DELETE SET NULL,
  target_amount   numeric(18, 2),
  goals           jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_portfolio_tier UNIQUE (user_id, tier_number)
);

CREATE INDEX IF NOT EXISTS portfolio_tiers_portfolio_id_idx
  ON markets.portfolio_tiers (portfolio_id);

ALTER TABLE markets.portfolio_tiers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'markets' AND tablename = 'portfolio_tiers'
      AND policyname = 'Users manage own tiers'
  ) THEN
    CREATE POLICY "Users manage own tiers"
      ON markets.portfolio_tiers
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

-- ── updated_at trigger (shared) ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION markets.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_risk_profiles_updated_at ON markets.risk_profiles;
CREATE TRIGGER trg_risk_profiles_updated_at
  BEFORE UPDATE ON markets.risk_profiles
  FOR EACH ROW EXECUTE FUNCTION markets.set_updated_at();

DROP TRIGGER IF EXISTS trg_portfolio_tiers_updated_at ON markets.portfolio_tiers;
CREATE TRIGGER trg_portfolio_tiers_updated_at
  BEFORE UPDATE ON markets.portfolio_tiers
  FOR EACH ROW EXECUTE FUNCTION markets.set_updated_at();
