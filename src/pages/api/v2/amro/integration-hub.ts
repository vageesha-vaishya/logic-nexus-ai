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

const ALLOWLISTED_SOURCES = new Set(['sap-pm', 'maximo', 'oracle-eam', 'boeing-partner-gateway']);
const MUTATING_EVENT_TYPES = new Set(['work_package_update', 'task_update', 'part_reservation', 'callback_trigger']);
const EXTERNAL_ADAPTER_CATALOG = [
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
] as const;

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

function assertAllowlistedSource(sourceSystem: string) {
  if (!ALLOWLISTED_SOURCES.has(sourceSystem)) {
    throw new Error('Source must be allow-listed');
  }
}

function assertIdempotencyForMutatingEvents(body: Record<string, unknown>) {
  const eventType = String(body.event_type || '').trim().toLowerCase();
  if (!MUTATING_EVENT_TYPES.has(eventType)) {
    return;
  }
  assertNonEmpty(body.idempotency_key, 'idempotency_key');
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

function resolveAdapterCatalogEntry(sourceSystem: string) {
  const normalized = sourceSystem.trim().toLowerCase();
  const matched = EXTERNAL_ADAPTER_CATALOG.find((entry) => entry.systems.includes(normalized as any));
  if (matched) return matched;
  return {
    adapter: 'erp-adapter',
    systems: [normalized],
    protocol: ['REST'],
    direction: 'bi-directional',
    purpose: 'Generic AMRO partner synchronization',
  };
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
      assertNonEmpty(body.adapter_version, 'adapter_version');
      assertNonEmpty(body.payload, 'payload');
      assertIdempotencyForMutatingEvents(body);
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
            source_schema: `${sourceSystem}:${body.adapter_version}`,
            canonical_model: 'amro.canonical.event.v1',
          },
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
      const attemptLog = parseObjectArray(body.attempt_log || [{ attempt: 1, status: 'queued' }], 'attempt_log');
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          callback_id: `${tenantId}-${targetPartner}-callback-${Date.now()}`,
          delivery_status: 'queued',
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
      error: 'Unsupported interface. Use list-external-adapters, ingest-partner-payload, replay-failed-integration-job, or publish-outbound-callback.',
      correlationId: ctx.correlationId,
      version: 'v2',
    });
  } catch (error: any) {
    return sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
