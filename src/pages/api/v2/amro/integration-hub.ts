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

const ALLOWLISTED_SOURCES = new Set(['sap-pm', 'maximo', 'oracle-eam', 'boeing-partner-gateway']);
const MUTATING_EVENT_TYPES = new Set(['work_package_update', 'task_update', 'part_reservation', 'callback_trigger']);

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

function assertMappingContract(body: Record<string, unknown>) {
  const contract = parseBody(body.mapping_contract);
  const schemaVersion = assertNonEmpty(contract.schema_version, 'mapping_contract.schema_version');
  const partnerSchemaVersion = assertNonEmpty(contract.partner_schema_version, 'mapping_contract.partner_schema_version');
  if (schemaVersion !== partnerSchemaVersion) {
    throw new Error('Mapping contract must match partner schema version');
  }
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
    const body = parseBody(req.body);

    if (interfaceName === 'ingest-partner-payload') {
      const sourceSystem = assertNonEmpty(body.source_system, 'source_system').toLowerCase();
      assertAllowlistedSource(sourceSystem);
      assertNonEmpty(body.adapter_version, 'adapter_version');
      assertNonEmpty(body.payload, 'payload');
      assertIdempotencyForMutatingEvents(body);
      const ingestionId = `${tenantId}-ingestion-${Date.now()}`;
      const canonicalEventId = `${sourceSystem}-${Date.now()}`;
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
          parse_status: 'parsed',
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
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          replay_id: `${tenantId}-${jobId}-replay-${Date.now()}`,
          replay_status: 'queued',
          retry_count: retryCount,
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
      error: 'Unsupported interface. Use ingest-partner-payload, replay-failed-integration-job, or publish-outbound-callback.',
      correlationId: ctx.correlationId,
      version: 'v2',
    });
  } catch (error: any) {
    return sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
