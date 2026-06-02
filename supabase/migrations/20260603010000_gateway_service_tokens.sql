-- LLM Gateway P2.2 — service tokens.
--
-- Per design §2.2. Service tokens identify the CALLING SERVICE
-- (logic-nexus-ai, aviation-ai-pro, sthira-mobile, ...) hitting the
-- gateway. They carry a scope set restricting what they can do.
--
-- Plaintext tokens never live in this table — only SHA-256 hashes.
-- Admin mints via gateway.mint_service_token(), gets the plaintext
-- ONCE, and stores it in the caller's vault. The token is unrecoverable
-- after mint; rotating means revoking the old + minting a new one.

CREATE TABLE gateway.service_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id     text NOT NULL,
  token_hash      text NOT NULL UNIQUE,         -- SHA-256 hex of the plaintext token
  token_prefix    text NOT NULL,                -- first 12 chars of plaintext (for log identification)
  scopes          text[] NOT NULL DEFAULT '{}'::text[],
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  last_used_at    timestamptz,
  expires_at      timestamptz,
  revoked_at      timestamptz,
  revoked_by_user_id uuid,
  CONSTRAINT scope_values_known CHECK (
    scopes <@ ARRAY[
      'invoke',
      'invoke_stream',
      'record_outcome',
      'submit_job',
      'read_usage',
      'admin_prompts',
      'admin_configs',
      'read_budget'
    ]
  )
);
CREATE INDEX service_tokens_active_hash_idx
  ON gateway.service_tokens (token_hash) WHERE status = 'active';
CREATE INDEX service_tokens_platform_idx
  ON gateway.service_tokens (platform_id, status, created_at DESC);

ALTER TABLE gateway.service_tokens ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON gateway.service_tokens TO service_role;

-- ── Mint helper. Admin calls this with desired platform_id + scopes;
--    DB generates a random token, returns plaintext ONCE.
CREATE OR REPLACE FUNCTION gateway.mint_service_token(
  p_platform_id  text,
  p_scopes       text[],
  p_notes        text DEFAULT NULL,
  p_expires_at   timestamptz DEFAULT NULL
)
RETURNS TABLE (token_plaintext text, token_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, gateway, extensions
AS $$
DECLARE
  v_token       text;
  v_hash        text;
  v_prefix      text;
  v_id          uuid;
BEGIN
  IF p_platform_id IS NULL OR length(trim(p_platform_id)) = 0 THEN
    RAISE EXCEPTION 'platform_id required';
  END IF;
  IF p_scopes IS NULL OR array_length(p_scopes, 1) IS NULL THEN
    RAISE EXCEPTION 'at least one scope required';
  END IF;

  -- Format: lngw_<32-bytes-base64url> ≈ 48 chars
  v_token  := 'lngw_' || replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_');
  v_token  := rtrim(v_token, '=');
  v_hash   := encode(digest(v_token, 'sha256'), 'hex');
  v_prefix := substring(v_token, 1, 12);

  INSERT INTO gateway.service_tokens
    (platform_id, token_hash, token_prefix, scopes, notes, expires_at, created_by_user_id)
  VALUES
    (p_platform_id, v_hash, v_prefix, p_scopes, p_notes, p_expires_at, auth.uid())
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_token, v_id;
END;
$$;

REVOKE ALL ON FUNCTION gateway.mint_service_token(text, text[], text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gateway.mint_service_token(text, text[], text, timestamptz) TO service_role;

COMMENT ON FUNCTION gateway.mint_service_token IS
  'Admin: generate a new gateway service token. Returns plaintext ONCE; only SHA-256 hash is persisted. Rotation = revoke old + mint new.';

CREATE OR REPLACE FUNCTION gateway.revoke_service_token(p_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, gateway
AS $$
BEGIN
  UPDATE gateway.service_tokens
     SET status = 'revoked',
         revoked_at = now(),
         revoked_by_user_id = auth.uid(),
         notes = COALESCE(notes, '') ||
                 CASE WHEN p_reason IS NOT NULL THEN E'\n[revoke] ' || p_reason ELSE '' END
   WHERE id = p_id AND status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION gateway.revoke_service_token(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gateway.revoke_service_token(uuid, text) TO service_role;
