// Phase 7 UIM Step 7.4 — connector adapter interface.
//
// Every external connector implements this shape. Same
// interface backs the loopback echo connector (this slice) and
// future real-world connectors (SAP business-partner sync, ERP
// bridges, etc.).
//
// Outbound surface:
//   - dispatch(event)  — called by the outbox dispatcher when a
//                        row matching this connector's
//                        webhook_subscriptions config fires.
//                        Returns OutboundDeliveryResult — same
//                        ok/permanent/transient discriminant as
//                        the DLQ processor.
//
// Inbound surface:
//   - parseInbound(payload) — called by the inbound webhook
//                        receiver after HMAC verification.
//                        Translates external schema into a UIM
//                        domain event that the application layer
//                        can dispatch.
//   - detectConflict(local, remote) — optional. Returns null when
//                        no conflict; otherwise a SyncConflictDraft
//                        the receiver inserts into uim.sync_conflicts.
//
// This file is types-only — implementations live in
// services/uim-api/src/connectors/<vendor>/. The registry in
// connectors/registry.ts wires connector_code → implementation.

export interface OutboundDeliveryResult {
  ok: boolean;
  status?: number;
  errorText?: string;
  /** 4xx (excluding 408/429) — caller stops retrying immediately. */
  permanent?: boolean;
}

export interface InboundParseResult {
  /** UIM domain event type, e.g. 'inventory.received', 'item.updated'. */
  eventType: string;
  /** Cleaned + tenant-scoped payload ready for the application layer. */
  domainPayload: Record<string, unknown>;
}

export interface SyncConflictDraft {
  conflict_kind:
    | 'field_mismatch'
    | 'duplicate_key'
    | 'foreign_key_missing'
    | 'unsupported_change'
    | 'race_condition'
    | 'schema_drift';
  subject_table: string;
  subject_record_id: string;
  local_payload: Record<string, unknown>;
  remote_payload: Record<string, unknown>;
  diff_summary?: string;
}

export interface ConnectorContext {
  tenantId: string;
  integrationId: string;
  vendorName: string | null;
  vendorCode: string | null;
  config: Record<string, unknown> | null;
}

export interface ConnectorAdapter {
  /** Stable connector slug matching uim.integrations.vendor. */
  vendorCode: string;
  /** Friendly name surfaced in connector manifests / admin UI. */
  displayName: string;
  /** Outbound delivery. Required even for inbound-only connectors;
   *  inbound-only adapters throw NOT_SUPPORTED from dispatch(). */
  dispatch(
    event: { type: string; payload: Record<string, unknown> },
    ctx: ConnectorContext,
  ): Promise<OutboundDeliveryResult>;
  /** Inbound parse. Required even for outbound-only connectors;
   *  outbound-only adapters throw NOT_SUPPORTED. */
  parseInbound(
    payload: Record<string, unknown>,
    ctx: ConnectorContext,
  ): Promise<InboundParseResult>;
  /** Optional conflict detector — null result = no conflict. */
  detectConflict?(
    local: Record<string, unknown>,
    remote: Record<string, unknown>,
    ctx: ConnectorContext,
  ): SyncConflictDraft | null;
}
