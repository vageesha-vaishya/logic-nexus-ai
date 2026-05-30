// Phase 6 comms-api — suppression list lookup + writes.
//
// Per comms-infrastructure.md §4.6, every outbound send is gated by
// comms.suppressions:
//   - hard bounces auto-add (permanent suppression)
//   - complaints auto-add (spam reports)
//   - manual / unsubscribe entries respected
// Soft bounces do not suppress (transient delivery failures).
//
// Lookup is per (tenant_id, channel_kind, address). UNIQUE constraint on
// the table makes the add() ON CONFLICT path idempotent.

import { SupabaseClient } from '@supabase/supabase-js';

import { logger } from '../utils/logger.js';
import type { ChannelKind } from '../types/comms.types.js';

export type SuppressionReason =
  | 'bounce_hard'
  | 'complaint'
  | 'unsubscribe'
  | 'manual'
  | 'invalid_format';

export async function isSuppressed(
  supabase: SupabaseClient,
  tenantId: string,
  channelKind: ChannelKind,
  address: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await (supabase as any)
    .schema('comms')
    .from('suppressions')
    .select('id, expires_at')
    .eq('tenant_id', tenantId)
    .eq('channel_kind', channelKind)
    .eq('address', address.toLowerCase())
    .maybeSingle();
  if (error) {
    logger.warn('suppressions lookup failed', { error: error.message });
    // Fail open — a transient db error must not silently drop mail.
    // A persistent failure shows up in metrics + the worker logs.
    return false;
  }
  if (!data) return false;
  if (data.expires_at && data.expires_at < now) return false;
  return true;
}

export async function addSuppression(
  supabase: SupabaseClient,
  args: {
    tenantId: string;
    channelKind: ChannelKind;
    address: string;
    reason: SuppressionReason;
    sourceEventId?: string | null;
    notes?: string | null;
    addedByKind?: 'webhook' | 'manual' | 'system';
  },
): Promise<void> {
  const payload = {
    tenant_id: args.tenantId,
    channel_kind: args.channelKind,
    address: args.address.toLowerCase(),
    reason: args.reason,
    source_event_id: args.sourceEventId ?? null,
    notes: args.notes ?? null,
    added_by_kind: args.addedByKind ?? 'system',
  };
  const { error } = await (supabase as any)
    .schema('comms')
    .from('suppressions')
    .upsert(payload, { onConflict: 'tenant_id,channel_kind,address', ignoreDuplicates: true });
  if (error) {
    logger.warn('suppression upsert failed', { error: error.message, ...payload });
  }
}
