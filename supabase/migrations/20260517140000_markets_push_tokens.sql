-- markets.push_tokens — stores device/browser push tokens per user.
-- Used by the markets-push-notify Edge Function.

CREATE TABLE IF NOT EXISTS markets.push_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       text NOT NULL,
  platform    text NOT NULL DEFAULT 'expo'
              CHECK (platform IN ('expo', 'fcm', 'apns', 'web')),
  device_name text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE markets.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own push tokens"
  ON markets.push_tokens
  FOR ALL
  USING (user_id = auth.uid());

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION markets.push_tokens_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER push_tokens_updated_at
  BEFORE UPDATE ON markets.push_tokens
  FOR EACH ROW EXECUTE FUNCTION markets.push_tokens_set_updated_at();
