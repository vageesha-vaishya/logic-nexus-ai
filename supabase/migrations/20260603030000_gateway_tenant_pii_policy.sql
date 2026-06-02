-- LLM Gateway P2.4 — per-tenant PII redaction policy.
-- Per design §4.4. When no row exists for a tenant, the gateway
-- applies a "strict" policy implicitly (redact all built-in kinds).

CREATE TABLE gateway.tenant_pii_policy (
  tenant_id                       uuid PRIMARY KEY,
  policy_kind                     text NOT NULL DEFAULT 'strict'
                                    CHECK (policy_kind IN ('strict','moderate','pass_through','custom')),
  redact_kinds                    text[] NOT NULL DEFAULT
                                    ARRAY['email','phone','ssn','credit_card','api_key','ip_address']::text[],
  custom_patterns                 jsonb NOT NULL DEFAULT '[]'::jsonb,
                                  -- shape: [{ "name": string, "pattern": string, "flags": string? }]
  preserve_mapping                boolean NOT NULL DEFAULT true,
                                  -- when true, gateway keeps the token→plaintext map for the
                                  -- duration of the invocation so the response can be un-redacted
  reject_on_unredactable          boolean NOT NULL DEFAULT false,
                                  -- when true, an INPUT that the redactor can't process (e.g. binary
                                  -- attachments) causes the invoke to fail-closed
  pii_pass_through_consented_at   timestamptz,
                                  -- required when policy_kind='pass_through'; absence triggers
                                  -- PII_PASS_THROUGH_NOT_CONSENTED error
  notes                           text,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pass_through_requires_consent CHECK (
    policy_kind <> 'pass_through' OR pii_pass_through_consented_at IS NOT NULL
  )
);

ALTER TABLE gateway.tenant_pii_policy ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON gateway.tenant_pii_policy TO service_role;

CREATE TRIGGER trg_gw_tpp_updated_at
  BEFORE UPDATE ON gateway.tenant_pii_policy
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

-- RLS: tenant admins can read their own policy (via the same
-- public.get_user_tenant_id helper). Mutations only via service_role.
CREATE POLICY tenant_pii_policy_tenant_select
  ON gateway.tenant_pii_policy FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
