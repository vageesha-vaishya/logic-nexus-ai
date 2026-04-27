import type { ApiRequest, ApiResponse } from '../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import { buildAmroServiceBoundaryEnvelope, createAmroIsolationScope } from './anti-corruption-adapter';
import { appendAmroAuditLedgerRecord } from './audit-ledger';
import { resolveAmroAuditLedgerCutoverState, resolveAmroV2EndpointRolloutState } from './audit-ledger-cutover';
import { enforceAmroSequentialMilestoneForIntegrationHubInterface } from './phase-plan-model';

const ALLOWLISTED_SOURCES = new Set(['sap-pm', 'maximo', 'oracle-eam', 'boeing-partner-gateway', 'regulatory-feed']);
const MUTATING_EVENT_TYPES = new Set(['work_order_update', 'task_update', 'part_reservation', 'callback_trigger']);
type ExternalAdapterDescriptor = {
  adapter: string;
  systems: string[];
  protocol: string[];
  direction: 'bi-directional' | 'inbound' | 'outbound';
  purpose: string;
};

const EXTERNAL_ADAPTER_CATALOG: ExternalAdapterDescriptor[] = [
  {
    adapter: 'erp-adapter',
    systems: ['sap-pm', 'oracle-eam'],
    protocol: ['REST', 'SOAP'],
    direction: 'bi-directional',
    purpose: 'Work order financials, procurement, cost posting',
  },
  {
    adapter: 'legacy-mro-adapter',
    systems: ['maximo'],
    protocol: ['REST', 'File'],
    direction: 'inbound',
    purpose: 'Historical records and active order migration',
  },
  {
    adapter: 'iot-telemetry-ingest',
    systems: ['boeing-partner-gateway'],
    protocol: ['MQTT', 'Kafka'],
    direction: 'inbound',
    purpose: 'Sensor events, condition monitoring, health indicators',
  },
  {
    adapter: 'regulatory-data-feed',
    systems: ['regulatory-feed'],
    protocol: ['API', 'SFTP'],
    direction: 'inbound',
    purpose: 'AD/SB bulletins and authority updates',
  },
  {
    adapter: 'notification-gateway',
    systems: ['notification-gateway'],
    protocol: ['Webhook', 'SMS', 'Email'],
    direction: 'outbound',
    purpose: 'Alerts, approvals, compliance exceptions',
  },
];

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isV2Enabled(): boolean {
  return parseBoolean(process.env.AMRO_INTEGRATION_HUB_V2_ENABLED, false);
}

function parseBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') {
    return body as Record<string, unknown>;
  }
  return {};
}

function assertNonEmpty(value: unknown, fieldName: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized;
}

function parseInteger(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldName} must be an integer`);
  }
  return parsed;
}

function parseNonNegativeInteger(value: unknown, fieldName: string): number {
  const parsed = parseInteger(value, fieldName);
  if (parsed < 0) {
    throw new Error(`${fieldName} must be zero or greater`);
  }
  return parsed;
}

function parseObjectArray(value: unknown, fieldName: string): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }
  return value.map((entry) => parseBody(entry));
}

function parseStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }
  const normalized = value.map((entry) => assertNonEmpty(entry, `${fieldName}[]`));
  return Array.from(new Set(normalized));
}

function parseOptionalStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean)));
}

function assertAllowlistedSource(sourceSystem: string) {
  if (!ALLOWLISTED_SOURCES.has(sourceSystem)) {
    throw new Error('Source must be allow-listed');
  }
}

function assertIdempotencyForMutatingEvents(body: Record<string, unknown>) {
  const idempotencyKey = assertNonEmpty(body.idempotency_key, 'idempotency_key');
  const eventType = String(body.event_type || '').trim().toLowerCase();
  if (eventType && !MUTATING_EVENT_TYPES.has(eventType)) {
    if (idempotencyKey.length < 8) {
      throw new Error('idempotency_key must satisfy minimum length requirements');
    }
    return;
  }
  if (idempotencyKey.length < 8) {
    throw new Error('idempotency_key must satisfy minimum length requirements');
  }
}

function assertReplayJobStatus(status: string) {
  if (status !== 'failed' && status !== 'quarantined') {
    throw new Error('Replay only allowed for failed/quarantined jobs');
  }
}

function buildReplayClosureMetrics(body: Record<string, unknown>) {
  const deadLetterCount = parseNonNegativeInteger(body.dead_letter_count ?? 1, 'dead_letter_count');
  const replayedCount = parseNonNegativeInteger(body.replayed_count ?? deadLetterCount, 'replayed_count');
  const closedCount = parseNonNegativeInteger(body.closed_count ?? replayedCount, 'closed_count');
  if (replayedCount > deadLetterCount) {
    throw new Error('replayed_count cannot exceed dead_letter_count');
  }
  if (closedCount > replayedCount) {
    throw new Error('closed_count cannot exceed replayed_count');
  }
  const closureRate = replayedCount === 0 ? 0 : Number(((closedCount / replayedCount) * 100).toFixed(2));
  return {
    dead_letter_count: deadLetterCount,
    replayed_count: replayedCount,
    closed_count: closedCount,
    closure_rate_percent: closureRate,
    replay_closure_status: closureRate === 100 ? 'closed' : 'partial',
  } as const;
}

function assertMappingContract(body: Record<string, unknown>) {
  const contract = parseBody(body.mapping_contract);
  const schemaVersion = assertNonEmpty(contract.schema_version, 'mapping_contract.schema_version');
  const partnerSchemaVersion = assertNonEmpty(contract.partner_schema_version, 'mapping_contract.partner_schema_version');
  if (schemaVersion !== partnerSchemaVersion) {
    throw new Error('Mapping contract must match partner schema version');
  }
}

function resolvePartnerContractCompatibility(body: Record<string, unknown>, fallbackSchemaVersionTag: string) {
  const schemaVersionTag = String(body.schema_version_tag || '').trim() || fallbackSchemaVersionTag;
  const requestedCapabilities = parseOptionalStringArray(body.requested_capabilities);
  const partnerCapabilities = parseOptionalStringArray(body.partner_capabilities);
  const requested = requestedCapabilities.length ? requestedCapabilities : ['core-sync'];
  const partner = partnerCapabilities.length ? partnerCapabilities : ['core-sync'];
  const agreedCapabilities = requested.filter((capability) => partner.includes(capability));
  if (agreedCapabilities.length === 0) {
    throw new Error('Capability negotiation failed: no shared capabilities');
  }
  const usesLegacyFallback = !String(body.schema_version_tag || '').trim() || requestedCapabilities.length === 0 || partnerCapabilities.length === 0;
  return {
    policy_version: 'amro.integration.contract.compatibility.v1',
    required_fields_stability: 'one_full_deprecation_cycle',
    additive_changes_only: true,
    schema_version_tag: schemaVersionTag,
    capability_negotiation: {
      requested_capabilities: requested,
      partner_capabilities: partner,
      agreed_capabilities: agreedCapabilities,
      negotiation_status: usesLegacyFallback ? 'legacy_fallback' : 'agreed',
    },
  } as const;
}

function resolveAdapterCatalogEntry(sourceSystem: string) {
  const normalized = sourceSystem.trim().toLowerCase();
  const matched = EXTERNAL_ADAPTER_CATALOG.find((entry) => entry.systems.includes(normalized));
  if (matched) return matched;
  return {
    adapter: 'erp-adapter',
    systems: [normalized],
    protocol: ['REST'],
    direction: 'bi-directional',
    purpose: 'Generic AMRO partner synchronization',
  };
}

function buildAdapterOutboxPayload(tenantId: string, sourceSystem: string, adapterVersion: string, eventType: string) {
  const canonicalEventId = `${sourceSystem}-${Date.now()}`;
  return {
    canonicalEventId,
    normalizer: {
      source_schema: `${sourceSystem}:${adapterVersion}`,
      canonical_model: 'amro.canonical.event.v1',
    },
    deduplication: {
      idempotency_key: `${tenantId}:${sourceSystem}:${canonicalEventId}`,
      source_hash: `${tenantId}:${sourceSystem}:${canonicalEventId}`,
      status: 'validated',
    },
    domain_transaction: {
      transaction_id: `${tenantId}-${canonicalEventId}-tx`,
      status: 'applied',
      audit_event_id: `${tenantId}-${canonicalEventId}-audit`,
    },
    outbox: {
      event_id: `${tenantId}-outbox-${Date.now()}`,
      event_type: eventType,
      publish_status: 'queued',
      consumers: ['analytics', 'downstream-consumers'],
    },
  };
}

function buildExponentialRetryPlan() {
  return {
    pattern: 'exponential_retry_with_dead_letter',
    base_delay_ms: 1000,
    max_attempts: 5,
    backoff_multiplier: 2,
    dead_letter_enabled: true,
    manual_replay_interface: 'replay-failed-integration-job',
  } as const;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const initialDecision = resolveGatewayCompatibility(req);
  applyCompatibilityResponseHeaders(res, initialDecision, ctx.correlationId);

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed`, correlationId: ctx.correlationId, version: 'v2' });
    }

    if (!isV2Enabled()) {
      return res.status(404).json({
        error: 'AMRO integration-hub v2 endpoint is disabled',
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    const access = await resolveAndApplyAccessContext(req, ctx);
    const compatDecision = resolveGatewayCompatibility(req, {
      tenantId: access.tenantId,
      franchiseId: access.franchiseId,
    });
    applyCompatibilityResponseHeaders(res, compatDecision, ctx.correlationId);

    const amroAccess = await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });
    const tenantId = String(access.tenantId || '');
    const franchiseId = access.franchiseId ? String(access.franchiseId) : null;
    const isolationScope = createAmroIsolationScope(tenantId, franchiseId);
    const serviceBoundaries = buildAmroServiceBoundaryEnvelope({
      capability: 'integration-hub',
      scope: isolationScope,
      subscriptionStatus: amroAccess.subscriptionStatus,
      validatedAt: amroAccess.validatedAt,
    });
    const rolloutState = resolveAmroV2EndpointRolloutState({
      tenantId,
      franchiseId,
      capability: 'integration-hub',
    });
    if (!rolloutState.enabled) {
      return res.status(404).json({
        error: 'AMRO integration-hub v2 endpoint is not enabled for this rollout cohort',
        endpointRollout: rolloutState,
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }
    const cutoverState = resolveAmroAuditLedgerCutoverState({
      tenantId,
      franchiseId,
      capability: 'integration-hub',
    });

    enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
    const interfaceName = String(req.query.interface || '').trim().toLowerCase();
    enforceAmroSequentialMilestoneForIntegrationHubInterface(interfaceName);
    const body = parseBody(req.body);

    if (interfaceName === 'list-external-adapters') {
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          adapters: EXTERNAL_ADAPTER_CATALOG,
        },
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        endpointRollout: rolloutState,
        auditLedgerCutover: cutoverState,
      });
    }

    if (interfaceName === 'ingest-partner-payload') {
      const sourceSystem = assertNonEmpty(body.source_system, 'source_system').toLowerCase();
      assertAllowlistedSource(sourceSystem);
      const adapterVersion = assertNonEmpty(body.adapter_version, 'adapter_version');
      assertNonEmpty(body.payload, 'payload');
      assertIdempotencyForMutatingEvents(body);
      const contractCompatibility = resolvePartnerContractCompatibility(body, adapterVersion);
      const ingestionId = `${tenantId}-ingestion-${Date.now()}`;
      const canonicalEventId = `${sourceSystem}-${Date.now()}`;
      const adapter = resolveAdapterCatalogEntry(sourceSystem);
      const outboxEventId = `${tenantId}-outbox-${Date.now()}`;
      const auditRecord = cutoverState.enabled
        ? appendAmroAuditLedgerRecord({
          tenantId,
          franchiseId,
          capability: 'integration-hub',
          eventType: 'amro.integration.payload.ingested.v1',
          entityType: 'integration-job',
          entityId: ingestionId,
          correlationId: ctx.correlationId,
          action: interfaceName,
          compatMode: compatDecision.compatMode,
          context: { sourceSystem, adapterVersion: body.adapter_version },
          sourceHash: `${tenantId}:${sourceSystem}:${canonicalEventId}`,
          migrationBatchId: `migration-${tenantId}-${Date.now()}`,
          replayCheckpoint: `integration-${Date.now()}`,
        })
        : null;
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          ingestion_id: ingestionId,
          canonical_event_id: canonicalEventId,
          adapter,
          parse_status: 'parsed',
          normalizer: {
            source_schema: `${sourceSystem}:${adapterVersion}`,
            canonical_model: 'amro.canonical.event.v1',
          },
          contract_compatibility: contractCompatibility,
          deduplication: {
            idempotency_key: String(body.idempotency_key || ''),
            source_hash: `${tenantId}:${sourceSystem}:${canonicalEventId}`,
            status: 'validated',
          },
          domain_transaction: {
            transaction_id: `${tenantId}-${canonicalEventId}-tx`,
            status: 'applied',
            audit_event_id: auditRecord?.recordId || `${tenantId}-${canonicalEventId}-audit`,
          },
          outbox: {
            event_id: outboxEventId,
            event_type: 'amro.integration.payload.ingested.v1',
            publish_status: 'queued',
            consumers: ['analytics', 'downstream-consumers'],
          },
        },
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        endpointRollout: rolloutState,
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? { eventType: auditRecord.eventType, recordId: auditRecord.recordId } : null,
      });
    }

    if (interfaceName === 'sync-erp-procurement-demand') {
      const sourceSystem = assertNonEmpty(body.source_system, 'source_system').toLowerCase();
      assertAllowlistedSource(sourceSystem);
      const adapterVersion = assertNonEmpty(body.adapter_version, 'adapter_version');
      const trigger = assertNonEmpty(body.trigger, 'trigger').toLowerCase();
      if (trigger !== 'reservation_shortage' && trigger !== 'planned_demand') {
        throw new Error('trigger must be reservation_shortage or planned_demand');
      }
      const purchaseDemandEvent = parseBody(body.purchase_demand_event);
      const demandReference = assertNonEmpty(purchaseDemandEvent.demand_ref, 'purchase_demand_event.demand_ref');
      const contractCompatibility = resolvePartnerContractCompatibility(body, adapterVersion);
      const sync = buildAdapterOutboxPayload(tenantId, sourceSystem, adapterVersion, 'amro.erp.procurement.demand.synced.v1');
      const retryPolicy = buildExponentialRetryPlan();
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          trigger,
          payload_standard: 'canonical_purchase_demand_event',
          demand_reference: demandReference,
          canonical_event_id: sync.canonicalEventId,
          normalizer: sync.normalizer,
          contract_compatibility: contractCompatibility,
          retry_policy: retryPolicy,
          dead_letter: {
            queue: 'amro.integration.dlq',
            status: 'armed',
            replay_interface: retryPolicy.manual_replay_interface,
          },
          manual_replay: {
            enabled: true,
            interface: retryPolicy.manual_replay_interface,
          },
          domain_transaction: sync.domain_transaction,
          outbox: sync.outbox,
        },
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        endpointRollout: rolloutState,
        auditLedgerCutover: cutoverState,
      });
    }

    if (interfaceName === 'sync-erp-financials') {
      const sourceSystem = assertNonEmpty(body.source_system, 'source_system').toLowerCase();
      assertAllowlistedSource(sourceSystem);
      const adapterVersion = assertNonEmpty(body.adapter_version, 'adapter_version');
      const workOrderId = assertNonEmpty(body.work_order_id, 'work_order_id');
      assertNonEmpty(body.financial_posting, 'financial_posting');
      const contractCompatibility = resolvePartnerContractCompatibility(body, adapterVersion);
      const adapter = resolveAdapterCatalogEntry(sourceSystem);
      const sync = buildAdapterOutboxPayload(tenantId, sourceSystem, adapterVersion, 'amro.erp.financials.synced.v1');
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          adapter,
          work_order_id: workOrderId,
          sync_status: 'posted',
          canonical_event_id: sync.canonicalEventId,
          normalizer: sync.normalizer,
          contract_compatibility: contractCompatibility,
          deduplication: sync.deduplication,
          domain_transaction: sync.domain_transaction,
          outbox: {
            ...sync.outbox,
            delivery_guarantee: 'guaranteed',
            acknowledgement_required: true,
          },
        },
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        endpointRollout: rolloutState,
        auditLedgerCutover: cutoverState,
      });
    }

    if (interfaceName === 'ingest-legacy-mro-records') {
      const sourceSystem = assertNonEmpty(body.source_system, 'source_system').toLowerCase();
      assertAllowlistedSource(sourceSystem);
      const adapterVersion = assertNonEmpty(body.adapter_version, 'adapter_version');
      const migrationBatchId = assertNonEmpty(body.migration_batch_id, 'migration_batch_id');
      const records = parseObjectArray(body.records, 'records');
      const contractCompatibility = resolvePartnerContractCompatibility(body, adapterVersion);
      const sync = buildAdapterOutboxPayload(tenantId, sourceSystem, adapterVersion, 'amro.legacy.records.ingested.v1');
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          migration_batch_id: migrationBatchId,
          accepted_count: records.length,
          canonical_event_id: sync.canonicalEventId,
          normalizer: sync.normalizer,
          contract_compatibility: contractCompatibility,
          deduplication: sync.deduplication,
          domain_transaction: sync.domain_transaction,
          outbox: sync.outbox,
        },
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        endpointRollout: rolloutState,
        auditLedgerCutover: cutoverState,
      });
    }

    if (interfaceName === 'ingest-iot-telemetry') {
      const sourceSystem = assertNonEmpty(body.source_system, 'source_system').toLowerCase();
      assertAllowlistedSource(sourceSystem);
      const adapterVersion = assertNonEmpty(body.adapter_version, 'adapter_version');
      const sensorEvents = parseObjectArray(body.sensor_events, 'sensor_events');
      const contractCompatibility = resolvePartnerContractCompatibility(body, adapterVersion);
      const seenSequenceKeys = new Set<string>();
      let malformedCount = 0;
      let duplicateCount = 0;
      let acceptedCount = 0;
      for (const event of sensorEvents) {
        const sourceId = String(event.source_id || '').trim();
        const sequence = Number(event.sequence);
        if (!sourceId || !Number.isInteger(sequence) || sequence < 0) {
          malformedCount += 1;
          continue;
        }
        const dedupKey = `${sourceId}:${sequence}`;
        if (seenSequenceKeys.has(dedupKey)) {
          duplicateCount += 1;
          continue;
        }
        seenSequenceKeys.add(dedupKey);
        acceptedCount += 1;
      }
      const sync = buildAdapterOutboxPayload(tenantId, sourceSystem, adapterVersion, 'amro.iot.telemetry.ingested.v1');
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          accepted_sensor_events: acceptedCount,
          malformed_sensor_events: malformedCount,
          canonical_event_id: sync.canonicalEventId,
          normalizer: sync.normalizer,
          contract_compatibility: contractCompatibility,
          deduplication: {
            ...sync.deduplication,
            strategy: 'source_id_sequence',
            duplicate_events_dropped: duplicateCount,
          },
          domain_transaction: sync.domain_transaction,
          outbox: sync.outbox,
        },
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        endpointRollout: rolloutState,
        auditLedgerCutover: cutoverState,
      });
    }

    if (interfaceName === 'ingest-regulatory-feed') {
      const sourceSystem = assertNonEmpty(body.source_system, 'source_system').toLowerCase();
      assertAllowlistedSource(sourceSystem);
      const adapterVersion = assertNonEmpty(body.adapter_version, 'adapter_version');
      const bulletins = parseObjectArray(body.bulletins, 'bulletins');
      const contractCompatibility = resolvePartnerContractCompatibility(body, adapterVersion);
      const validBulletins: Array<Record<string, unknown>> = [];
      const quarantine: Array<{ bulletin_id: string; reason: string }> = [];
      for (const bulletin of bulletins) {
        const bulletinId = String(bulletin.bulletin_id || '').trim();
        const obligationCode = String(bulletin.obligation_code || '').trim();
        const effectiveAt = String(bulletin.effective_at || '').trim();
        if (!bulletinId || !obligationCode || !effectiveAt) {
          quarantine.push({
            bulletin_id: bulletinId || 'unknown',
            reason: 'missing_required_fields',
          });
          continue;
        }
        validBulletins.push(bulletin);
      }
      const sync = buildAdapterOutboxPayload(tenantId, sourceSystem, adapterVersion, 'amro.regulatory.feed.ingested.v1');
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          accepted_bulletins: validBulletins.length,
          quarantined_bulletins: quarantine.length,
          quarantine,
          canonical_event_id: sync.canonicalEventId,
          normalizer: sync.normalizer,
          contract_compatibility: contractCompatibility,
          validation_quarantine: {
            status: quarantine.length > 0 ? 'active' : 'clear',
            queue: 'amro.regulatory.validation.quarantine',
          },
          deduplication: sync.deduplication,
          domain_transaction: sync.domain_transaction,
          outbox: {
            ...sync.outbox,
            publish_status: validBulletins.length > 0 ? 'queued' : 'skipped',
          },
        },
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        endpointRollout: rolloutState,
        auditLedgerCutover: cutoverState,
      });
    }

    if (interfaceName === 'dispatch-notification-gateway') {
      const targetPartner = assertNonEmpty(body.target_partner, 'target_partner');
      const notificationType = assertNonEmpty(body.notification_type, 'notification_type');
      const messageRef = assertNonEmpty(body.message_ref, 'message_ref');
      const channels = parseObjectArray(body.channels, 'channels');
      const contractCompatibility = resolvePartnerContractCompatibility(body, 'notification.command.v1');
      const failedChannelTypes = new Set(parseOptionalStringArray(body.fail_channels).map((entry) => entry.toLowerCase()));
      const attempts = channels.map((channel, index) => {
        const channelType = String(channel.type || '').trim().toLowerCase() || `channel-${index + 1}`;
        const status = failedChannelTypes.has(channelType) ? 'failed' : 'delivered';
        return {
          attempt: index + 1,
          channel: channelType,
          status,
        };
      });
      const deliveredAttempt = attempts.find((attempt) => attempt.status === 'delivered');
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          target_partner: targetPartner,
          notification_type: notificationType,
          message_ref: messageRef,
          channel_count: channels.length,
          contract_compatibility: contractCompatibility,
          retry_strategy: 'retry_with_channel_fallback',
          channel_attempts: attempts,
          fallback_channel_used: Boolean(deliveredAttempt && deliveredAttempt.attempt > 1),
          dispatch_status: deliveredAttempt ? 'delivered' : 'failed',
          callback_id: `${tenantId}-${targetPartner}-notify-${Date.now()}`,
        },
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        endpointRollout: rolloutState,
        auditLedgerCutover: cutoverState,
      });
    }

    if (interfaceName === 'replay-failed-integration-job') {
      const jobId = assertNonEmpty(body.job_id, 'job_id');
      assertNonEmpty(body.replay_reason, 'replay_reason');
      assertNonEmpty(body.requested_by, 'requested_by');
      const jobStatus = assertNonEmpty(body.job_status, 'job_status').toLowerCase();
      assertReplayJobStatus(jobStatus);
      const retryCount = parseInteger(body.retry_count || 0, 'retry_count') + 1;
      const replayMetrics = buildReplayClosureMetrics(body);
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          replay_id: `${tenantId}-${jobId}-replay-${Date.now()}`,
          replay_status: 'queued',
          retry_count: retryCount,
          replay_metrics: replayMetrics,
        },
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        endpointRollout: rolloutState,
        auditLedgerCutover: cutoverState,
      });
    }

    if (interfaceName === 'publish-outbound-callback') {
      const targetPartner = assertNonEmpty(body.target_partner, 'target_partner');
      const eventType = assertNonEmpty(body.event_type, 'event_type');
      const payloadRef = assertNonEmpty(body.payload_ref, 'payload_ref');
      assertMappingContract(body);
      const contractCompatibility = resolvePartnerContractCompatibility(body, 'outbound.callback.v1');
      const attemptLog = parseObjectArray(body.attempt_log || [{ attempt: 1, status: 'queued' }], 'attempt_log');
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          callback_id: `${tenantId}-${targetPartner}-callback-${Date.now()}`,
          delivery_status: 'queued',
          publish_status: 'dispatched',
          contract_compatibility: contractCompatibility,
          attempt_log: attemptLog.length ? attemptLog : [{ attempt: 1, status: 'queued', event_type: eventType, payload_ref: payloadRef }],
        },
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        endpointRollout: rolloutState,
        auditLedgerCutover: cutoverState,
      });
    }

    return res.status(400).json({
      error: 'Unsupported interface. Use list-external-adapters, ingest-partner-payload, sync-erp-procurement-demand, sync-erp-financials, ingest-legacy-mro-records, ingest-iot-telemetry, ingest-regulatory-feed, dispatch-notification-gateway, replay-failed-integration-job, or publish-outbound-callback.',
      correlationId: ctx.correlationId,
      version: 'v2',
    });
  } catch (error: any) {
    return sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
