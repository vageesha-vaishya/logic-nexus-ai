-- Phase 1 Slice C — core.secrets
-- Per master design doc §2.7 + core.md §3.9 + comms-infrastructure.md §4.2
--
-- Metadata registry for tenant-owned secrets. The actual encrypted secret
-- value lives in supabase_vault (vault.decrypted_secrets); this table holds
-- the metadata + the vault_secret_name pointer.
--
-- Pattern follows platform.llm_provider_configs.vault_secret_name (already
-- in use for LLM API keys since 2026-05-15). This migration generalises the
-- pattern so OAuth tokens, SMTP/IMAP passwords, webhook signing secrets, etc.
-- all land in one place.
--
-- Closes G-CR-1 from comms-infrastructure.md §3:
--   plaintext OAuth tokens + SMTP/IMAP passwords in public.email_accounts.
--
-- A companion migration (separate PR) backfills existing email_accounts
-- credentials into core.secrets + drops the plaintext columns.

CREATE TABLE core.secrets (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid,                                       -- NULL = platform-level (e.g. shared webhook signing key)

  -- The pointer into supabase_vault. The vault row holds the encrypted value;
  -- this column is the name the application uses to fetch it.
  vault_secret_name     text NOT NULL UNIQUE,

  -- What kind of secret is this. Drives routing + rotation policy.
  purpose               text NOT NULL
                        CHECK (purpose IN (
                          'oauth_access_token',
                          'oauth_refresh_token',
                          'smtp_password',
                          'imap_password',
                          'provider_api_key',         -- e.g. Resend, Anthropic, Twilio
                          'webhook_signing_secret',   -- inbound webhook signature verification
                          'webhook_outbound_secret',  -- outbound webhook HMAC
                          'hmac_unsubscribe',         -- One-click unsubscribe token HMAC
                          'oauth_client_secret',
                          'encryption_key',
                          'custom'
                        )),

  -- What does this secret belong to? Polymorphic per platform §2.4 convention.
  -- Examples: 'comms.email_account', 'core.llm_provider', 'finance.payment_gateway',
  -- 'uim.integration_connector'.
  subject_kind          text NOT NULL,
  subject_id            uuid,                                       -- NULL when secret is not tied to a specific row (e.g. tenant-wide API key)

  -- Lifecycle
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by_user_id    uuid,
  expires_at            timestamptz,                                -- e.g. OAuth access_token expiry
  rotated_at            timestamptz,                                -- last manual rotation
  last_accessed_at      timestamptz,                                -- updated by access via a service-side helper

  -- Audit trail breadcrumbs
  metadata              jsonb NOT NULL DEFAULT '{}'                  -- e.g. {provider:'gmail', scopes:[...], oauth_provider_id:...}
);

COMMENT ON TABLE core.secrets IS
  'Tenant-secret metadata registry. Actual encrypted values live in supabase_vault. Per master §2.7 + core.md §3.9. Closes G-CR-1 from comms-infrastructure.md §3.';

COMMENT ON COLUMN core.secrets.vault_secret_name IS
  'Unique name to look up the secret value via vault.decrypted_secrets. Application code never stores or logs the value; it fetches just-in-time using this name.';

COMMENT ON COLUMN core.secrets.purpose IS
  'What kind of secret. Drives rotation policy: oauth_access_token rotates per refresh; provider_api_key rotates manually; hmac_unsubscribe rotates rarely.';

-- Indexes
CREATE INDEX secrets_subject_idx
  ON core.secrets (tenant_id, subject_kind, subject_id)
  WHERE is_active = true;

CREATE INDEX secrets_purpose_idx
  ON core.secrets (tenant_id, purpose)
  WHERE is_active = true;

CREATE INDEX secrets_expiring_idx
  ON core.secrets (expires_at)
  WHERE is_active = true AND expires_at IS NOT NULL;

-- One active secret per (tenant, subject_kind, subject_id, purpose) — prevents
-- accidental dual tokens for the same purpose.
CREATE UNIQUE INDEX secrets_unique_active_per_purpose
  ON core.secrets (tenant_id, subject_kind, subject_id, purpose)
  WHERE is_active = true AND subject_id IS NOT NULL;

-- RLS — secrets are NEVER readable by authenticated users from the frontend.
-- Backend services use service_role to fetch metadata, then call vault to
-- decrypt the actual value. Tenant admins can SEE metadata (purpose, expiry,
-- rotated_at) but never the vault contents.
ALTER TABLE core.secrets ENABLE ROW LEVEL SECURITY;

-- Tenant admin: read-only metadata for own tenant
CREATE POLICY secrets_tenant_admin_select ON core.secrets
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
    AND (
      public.has_role((SELECT auth.uid()), 'tenant_admin'::public.app_role)
      OR public.has_role((SELECT auth.uid()), 'platform_admin'::public.app_role)
    )
  );

-- service_role: full access (writes happen server-side via secure helpers)
GRANT SELECT ON core.secrets TO authenticated;
GRANT ALL    ON core.secrets TO service_role;
