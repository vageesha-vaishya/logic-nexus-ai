// Phase 7 UIM Step 7.4 — reference echo connector.
//
// Loopback adapter for end-to-end testing of the full external-
// connector lifecycle without third-party API keys:
//
//   1. dispatch(event) — does NOT POST to a real URL. Echoes the
//      event back as a successful 200 response and (for the
//      inbound mirror behavior) inserts a uim.integration_log row
//      with direction='inbound' carrying the same payload. This
//      proves the outbox → dispatcher → inbound receiver path.
//
//   2. parseInbound(payload) — preserves event_type from headers
//      and returns the payload unchanged. The "external schema"
//      and the "UIM domain event" are identical for the echo.
//
//   3. detectConflict(local, remote) — JSON-equality check.
//      Different JSON shape → field_mismatch conflict. Identical
//      → null. Useful for exercising the sync_conflicts surface
//      from automated tests.
//
// Activate by inserting a uim.integrations row with
// vendor='echo' + direction='bidirectional'.

import { createClient } from '@supabase/supabase-js';

import { logger } from '../utils/logger.js';
import type {
  ConnectorAdapter,
  ConnectorContext,
  InboundParseResult,
  OutboundDeliveryResult,
  SyncConflictDraft,
} from './types.js';

function getServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('echo connector requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

export const echoConnector: ConnectorAdapter = {
  vendorCode: 'echo',
  displayName: 'Reference Echo Connector (loopback)',

  async dispatch(event, ctx): Promise<OutboundDeliveryResult> {
    // Loopback "POST": don't actually fetch — write the inbound
    // mirror row directly. In production this is the real fetch
    // against the external system.
    try {
      const supabase = getServiceRoleClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .schema('uim')
        .from('integration_log')
        .insert({
          tenant_id: ctx.tenantId,
          integration_id: ctx.integrationId,
          direction: 'inbound',
          method: 'POST',
          url_path: `/api/v1/uim/inbound/${ctx.integrationId}`,
          status: 202,
          body_redacted: {
            event_type: event.type,
            payload: event.payload,
            via: 'echo-connector-loopback',
          },
        });
      if (error) {
        return { ok: false, errorText: `echo loopback insert failed: ${error.message}` };
      }
      logger.info('echo connector: dispatched + mirrored', {
        integrationId: ctx.integrationId,
        eventType: event.type,
      });
      return { ok: true, status: 200 };
    } catch (err) {
      return {
        ok: false,
        errorText: err instanceof Error ? err.message : String(err),
      };
    }
  },

  async parseInbound(payload, ctx): Promise<InboundParseResult> {
    // Echo passes through unchanged. Real connectors map external
    // schema → UIM domain shape here.
    const eventType = typeof payload.event_type === 'string'
      ? payload.event_type
      : 'echo.received';
    logger.info('echo connector: parsed inbound', {
      integrationId: ctx.integrationId,
      eventType,
    });
    return { eventType, domainPayload: payload };
  },

  detectConflict(local, remote): SyncConflictDraft | null {
    // JSON-equality is good enough for the reference connector.
    // Real connectors layer per-field tolerance + canonicalization.
    const localStr = JSON.stringify(local);
    const remoteStr = JSON.stringify(remote);
    if (localStr === remoteStr) return null;
    return {
      conflict_kind: 'field_mismatch',
      subject_table: 'echo',
      subject_record_id: String(local.id || remote.id || 'unknown'),
      local_payload: local,
      remote_payload: remote,
      diff_summary: `JSON differ: local=${localStr.length}B remote=${remoteStr.length}B`,
    };
  },
};
