-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260517113345; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

CREATE TABLE IF NOT EXISTS markets.push_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       text NOT NULL,
  platform    text NOT NULL DEFAULT 'expo' CHECK (platform IN ('expo', 'fcm', 'apns', 'web')),
  device_name text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, token)
);
ALTER TABLE markets.push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own push tokens" ON markets.push_tokens FOR ALL USING (user_id = auth.uid());