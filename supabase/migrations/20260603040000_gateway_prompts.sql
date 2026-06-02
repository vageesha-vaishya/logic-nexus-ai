-- LLM Gateway P3.1 — prompt management storage.
-- Per design §5.3. Two tables + a create-or-bump helper RPC.

CREATE TABLE gateway.prompts (
  key                 text PRIMARY KEY,
  module              text NOT NULL,
  feature             text NOT NULL,
  description         text,
  active_version_id   uuid,           -- FK added after prompt_versions exists
  status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','deprecated','archived')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE gateway.prompts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON gateway.prompts TO service_role;
CREATE TRIGGER trg_gw_prompts_updated_at BEFORE UPDATE ON gateway.prompts
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

CREATE TABLE gateway.prompt_versions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key               text NOT NULL REFERENCES gateway.prompts(key) ON DELETE RESTRICT,
  version_number           integer NOT NULL,
  body                     text NOT NULL,
  body_variants            jsonb NOT NULL DEFAULT '{}'::jsonb,
                           -- per-provider overrides keyed by provider_kind
  frontmatter              jsonb NOT NULL DEFAULT '{}'::jsonb,
                           -- YAML frontmatter parsed from git-canonical authoring
  input_schema             jsonb,        -- JSON Schema for variables (optional)
  output_schema            jsonb,        -- JSON Schema for structured output (optional)
  default_capability       text,         -- e.g. 'reasoning-high', 'chat-fast'
  default_temperature      numeric(3,2),
  default_max_tokens       integer,
  cache_ttl_seconds        integer NOT NULL DEFAULT 0,
  safety_class             text NOT NULL DEFAULT 'standard'
                             CHECK (safety_class IN ('standard','elevated','restricted')),
  status                   text NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','active','superseded','rolled_back')),
  source                   text NOT NULL DEFAULT 'admin_ui'
                             CHECK (source IN ('git','admin_ui')),
  git_sha                  text,
  created_by_user_id       uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  promoted_at              timestamptz,
  promoted_by_user_id      uuid,
  UNIQUE (prompt_key, version_number)
);
CREATE INDEX prompt_versions_key_status_idx
  ON gateway.prompt_versions (prompt_key, status, version_number DESC);
ALTER TABLE gateway.prompt_versions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON gateway.prompt_versions TO service_role;

-- Now wire the FK on prompts.active_version_id (deferred so the two
-- tables can be created in either order).
ALTER TABLE gateway.prompts
  ADD CONSTRAINT prompts_active_version_fk
  FOREIGN KEY (active_version_id) REFERENCES gateway.prompt_versions(id) ON DELETE SET NULL;

-- ── Helper: create or bump a prompt version in one round-trip.
-- Inserts the gateway.prompts row if absent, computes the next
-- version_number, inserts the version, and (when p_promote_active)
-- flips prompts.active_version_id atomically. Returns the version_id.
CREATE OR REPLACE FUNCTION gateway.upsert_prompt_version(
  p_key                 text,
  p_module              text,
  p_feature             text,
  p_body                text,
  p_description         text     DEFAULT NULL,
  p_body_variants       jsonb    DEFAULT '{}'::jsonb,
  p_frontmatter         jsonb    DEFAULT '{}'::jsonb,
  p_input_schema        jsonb    DEFAULT NULL,
  p_output_schema       jsonb    DEFAULT NULL,
  p_default_capability  text     DEFAULT NULL,
  p_default_temperature numeric  DEFAULT NULL,
  p_default_max_tokens  integer  DEFAULT NULL,
  p_cache_ttl_seconds   integer  DEFAULT 0,
  p_safety_class        text     DEFAULT 'standard',
  p_source              text     DEFAULT 'admin_ui',
  p_git_sha             text     DEFAULT NULL,
  p_promote_active      boolean  DEFAULT true
)
RETURNS TABLE (version_id uuid, version_number int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, gateway
AS $$
DECLARE
  v_next_version int;
  v_version_id   uuid;
BEGIN
  INSERT INTO gateway.prompts (key, module, feature, description)
  VALUES (p_key, p_module, p_feature, p_description)
  ON CONFLICT (key) DO UPDATE
    SET module = EXCLUDED.module,
        feature = EXCLUDED.feature,
        description = COALESCE(EXCLUDED.description, gateway.prompts.description);

  SELECT COALESCE(MAX(pv.version_number), 0) + 1 INTO v_next_version
  FROM gateway.prompt_versions pv WHERE pv.prompt_key = p_key;

  INSERT INTO gateway.prompt_versions (
    prompt_key, version_number, body, body_variants, frontmatter,
    input_schema, output_schema, default_capability, default_temperature,
    default_max_tokens, cache_ttl_seconds, safety_class, source, git_sha,
    status, created_by_user_id, promoted_at, promoted_by_user_id
  ) VALUES (
    p_key, v_next_version, p_body, p_body_variants, p_frontmatter,
    p_input_schema, p_output_schema, p_default_capability, p_default_temperature,
    p_default_max_tokens, p_cache_ttl_seconds, p_safety_class, p_source, p_git_sha,
    CASE WHEN p_promote_active THEN 'active' ELSE 'draft' END,
    auth.uid(),
    CASE WHEN p_promote_active THEN now() ELSE NULL END,
    CASE WHEN p_promote_active THEN auth.uid() ELSE NULL END
  )
  RETURNING id INTO v_version_id;

  IF p_promote_active THEN
    -- Supersede the previous active version
    UPDATE gateway.prompt_versions
      SET status = 'superseded'
      WHERE prompt_key = p_key AND status = 'active' AND id <> v_version_id;
    UPDATE gateway.prompts
      SET active_version_id = v_version_id
      WHERE key = p_key;
  END IF;

  RETURN QUERY SELECT v_version_id, v_next_version;
END;
$$;
REVOKE ALL ON FUNCTION gateway.upsert_prompt_version FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gateway.upsert_prompt_version TO service_role;
