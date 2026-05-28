// Phase 1 Slice C tail — single entry point for email-account credentials.
//
// Wraps the SECURITY DEFINER RPCs core.read_email_account_credential and
// core.write_email_account_credential (migration 20260528250000) so every
// edge-function send/sync path reads + rotates through vault instead of
// the public.email_accounts plaintext columns.
//
// Reader behaviour: if vault has no active row for the (account, purpose),
// returns the supplied `fallback` value. That fallback is the column
// value the caller already had in hand from its email_accounts SELECT —
// it keeps email I/O working during the transition window between this
// PR landing and the follow-up migration that NULLs the plaintext
// columns. Once those columns are NULLed, the fallback path becomes a
// dead branch and the caller can remove the column from its SELECT.
//
// Writer behaviour: stores ONLY in vault. After the cutover the writer
// path no longer touches the email_accounts column at all.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type EmailCredentialPurpose =
  | "oauth_access_token"
  | "oauth_refresh_token"
  | "smtp_password"
  | "imap_password";

/**
 * Reads the credential for (accountId, purpose). Returns the vault value
 * if present, otherwise falls back to `fallback` (typically the plaintext
 * column from the email_accounts SELECT). Returns null if both are absent.
 *
 * Never throws on RPC error — falls back so a transient infra hiccup
 * doesn't kill the entire send/sync path.
 */
export async function getEmailCredential(
  supabase: SupabaseClient,
  args: {
    account_id: string;
    purpose:    EmailCredentialPurpose;
    fallback?:  string | null;
  },
  logger?: { error: (msg: string, meta?: unknown) => void; warn?: (msg: string, meta?: unknown) => void },
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .schema("core")
      .rpc("read_email_account_credential", {
        p_account_id: args.account_id,
        p_purpose:    args.purpose,
      });
    if (error) {
      logger?.error("core.read_email_account_credential failed; falling back", {
        account_id: args.account_id,
        purpose:    args.purpose,
        error,
      });
      return args.fallback ?? null;
    }
    if (typeof data === "string" && data.length > 0) {
      return data;
    }
    // No vault row → use the plaintext fallback (transition phase).
    if (args.fallback) {
      logger?.warn?.("email credential not in vault; using plaintext column fallback", {
        account_id: args.account_id,
        purpose:    args.purpose,
      });
    }
    return args.fallback ?? null;
  } catch (err) {
    logger?.error("getEmailCredential threw; falling back", { error: err });
    return args.fallback ?? null;
  }
}

/**
 * Writes (or rotates) the credential. The RPC deactivates any prior
 * active row for the (account, purpose) and inserts a fresh one. Used by
 * exchange-oauth-token on initial connection and by the OAuth refresh
 * paths in send-email + sync-emails*.
 */
export async function setEmailCredential(
  supabase: SupabaseClient,
  args: {
    account_id:  string;
    purpose:     EmailCredentialPurpose;
    value:       string;
    tenant_id?:  string | null;
    expires_at?: string | null;
    metadata?:   Record<string, unknown>;
  },
  logger?: { error: (msg: string, meta?: unknown) => void },
): Promise<{ ok: boolean; error?: unknown }> {
  try {
    const { error } = await supabase
      .schema("core")
      .rpc("write_email_account_credential", {
        p_account_id:  args.account_id,
        p_purpose:     args.purpose,
        p_value:       args.value,
        p_tenant_id:   args.tenant_id ?? null,
        p_expires_at:  args.expires_at ?? null,
        p_metadata:    args.metadata   ?? {},
      });
    if (error) {
      logger?.error("core.write_email_account_credential failed", {
        account_id: args.account_id,
        purpose:    args.purpose,
        error,
      });
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    logger?.error("setEmailCredential threw", { error: err });
    return { ok: false, error: err };
  }
}
