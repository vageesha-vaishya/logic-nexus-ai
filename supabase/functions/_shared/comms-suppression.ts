// Shared helper: check whether a given address is suppressed for a tenant.
//
// Per comms-infrastructure.md §4.6, every outbound send path MUST consult
// this before delivering. Calls comms.is_suppressed() — the SECURITY DEFINER
// function created in migration 20260528140200_create_comms_suppressions.sql.
//
// Address normalisation matches comms.suppressions storage convention:
//   email → lowercase + trim
//   sms / whatsapp / push → trim (assumed E.164 already)

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ChannelKind = "email" | "sms" | "whatsapp" | "push" | "in_app";

/**
 * Sentinel tenant UUID for platform-level outbound sends that don't belong
 * to any tenant (ops alerts, marketing-inquiry notifications to the SOS
 * Services inbox, build-failure pings, etc.). Allows the platform team to
 * unsubscribe an ops address by inserting one row keyed on this UUID
 * without polluting any real tenant's suppression list.
 */
export const PLATFORM_OPS_TENANT_ID =
  "00000000-0000-0000-0000-000000000000";

function normalise(channelKind: ChannelKind, address: string): string {
  if (channelKind === "email") return address.trim().toLowerCase();
  return address.trim();
}

/**
 * Returns true if the given address is currently suppressed for the tenant
 * + channel combination. NEVER fails the send path on lookup error — falls
 * open (returns false) so that infrastructure hiccups don't block all email.
 * Errors are logged via the supplied logger.
 */
export async function isAddressSuppressed(
  supabase: SupabaseClient,
  args: {
    tenant_id: string;
    channel_kind: ChannelKind;
    address: string;
  },
  logger?: { error: (msg: string, meta?: unknown) => void },
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .schema("comms")
      .rpc("is_suppressed", {
        p_tenant_id: args.tenant_id,
        p_channel_kind: args.channel_kind,
        p_address: normalise(args.channel_kind, args.address),
      });
    if (error) {
      logger?.error("comms.is_suppressed RPC failed; falling open (allowing send)", { error });
      return false;
    }
    return data === true;
  } catch (err) {
    logger?.error("isAddressSuppressed threw; falling open", { error: err });
    return false;
  }
}

/**
 * Bulk variant — useful when a send call has multiple recipients (CC/BCC).
 * Returns the SUBSET of addresses that are suppressed (and therefore must
 * be skipped). Callers filter their `to`/`cc`/`bcc` arrays against this.
 */
export async function filterSuppressed(
  supabase: SupabaseClient,
  args: {
    tenant_id: string;
    channel_kind: ChannelKind;
    addresses: string[];
  },
  logger?: { error: (msg: string, meta?: unknown) => void },
): Promise<{ allowed: string[]; suppressed: string[] }> {
  if (args.addresses.length === 0) return { allowed: [], suppressed: [] };
  const allowed: string[] = [];
  const suppressed: string[] = [];
  for (const addr of args.addresses) {
    const blocked = await isAddressSuppressed(
      supabase,
      { tenant_id: args.tenant_id, channel_kind: args.channel_kind, address: addr },
      logger,
    );
    (blocked ? suppressed : allowed).push(addr);
  }
  return { allowed, suppressed };
}
