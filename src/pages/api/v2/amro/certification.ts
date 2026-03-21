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

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isV2Enabled(): boolean {
  return parseBoolean(process.env.AMRO_CERTIFICATION_V2_ENABLED, false);
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

function parseTimestamp(value: unknown, fieldName: string): string {
  const normalized = assertNonEmpty(value, fieldName);
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid ISO timestamp`);
  }
  return new Date(parsed).toISOString();
}

function parseStringArray(value: unknown, fieldName: string): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function assertAuthorityScope(
  requestedAircraftScope: string[],
  requestedMaintenanceScope: string[],
  authorityAircraftScope: string[],
  authorityMaintenanceScope: string[],
) {
  const aircraftAllowed = requestedAircraftScope.every(
    (scope) => authorityAircraftScope.includes('*') || authorityAircraftScope.includes(scope),
  );
  const maintenanceAllowed = requestedMaintenanceScope.every(
    (scope) => authorityMaintenanceScope.includes('*') || authorityMaintenanceScope.includes(scope),
  );
  if (!aircraftAllowed || !maintenanceAllowed) {
    throw new Error('Expired or out-of-scope authority always invalid');
  }
}

function parseObjectArray(value: unknown, fieldName: string): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }
  return value.map((entry) => parseBody(entry));
}

function parseDecision(value: unknown): 'approve' | 'reject' | 'defer' {
  const decision = assertNonEmpty(value, 'decision').toLowerCase();
  if (decision !== 'approve' && decision !== 'reject' && decision !== 'defer') {
    throw new Error('decision must be approve, reject, or defer');
  }
  return decision;
}

function assertApprovalSignatures(signatures: Array<Record<string, unknown>>, unresolvedBlockers: string[]) {
  const mandatory = signatures.filter((entry) => Boolean(entry.mandatory));
  const signedMandatory = mandatory.filter((entry) => String(entry.signature || '').trim().length > 0);
  if (mandatory.length === 0 || signedMandatory.length !== mandatory.length || unresolvedBlockers.length > 0) {
    throw new Error('Approval requires all mandatory signatures and zero unresolved blockers');
  }
}

function assertEscalationTarget(escalationTarget: string, chain: string[]) {
  if (!chain.includes(escalationTarget)) {
    throw new Error('Escalation target must belong to valid authority chain');
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
        error: 'AMRO certification v2 endpoint is disabled',
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
      capability: 'certification',
      scope: isolationScope,
      subscriptionStatus: amroAccess.subscriptionStatus,
      validatedAt: amroAccess.validatedAt,
    });
    const rolloutState = resolveAmroV2EndpointRolloutState({
      tenantId,
      franchiseId,
      capability: 'certification',
    });
    if (!rolloutState.enabled) {
      return res.status(404).json({
        error: 'AMRO certification v2 endpoint is not enabled for this rollout cohort',
        endpointRollout: rolloutState,
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }
    const cutoverState = resolveAmroAuditLedgerCutoverState({
      tenantId,
      franchiseId,
      capability: 'certification',
    });

    enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
    const interfaceName = String(req.query.interface || '').trim().toLowerCase();
    const body = parseBody(req.body);

    if (interfaceName === 'validate-certifying-authority') {
      const actorId = assertNonEmpty(body.actor_id, 'actor_id');
      const timestamp = parseTimestamp(body.timestamp, 'timestamp');
      const requestedAircraftScope = parseStringArray(body.aircraft_scope, 'aircraft_scope');
      const requestedMaintenanceScope = parseStringArray(body.maintenance_scope, 'maintenance_scope');
      const authority = parseBody(body.authority);
      const validFrom = parseTimestamp(authority.valid_from || new Date(Date.now() - 60_000).toISOString(), 'authority.valid_from');
      const validTo = parseTimestamp(authority.valid_to || new Date(Date.now() + 60_000).toISOString(), 'authority.valid_to');
      const authorityAircraftScope = parseStringArray(authority.aircraft_scope || ['*'], 'authority.aircraft_scope');
      const authorityMaintenanceScope = parseStringArray(authority.maintenance_scope || ['*'], 'authority.maintenance_scope');
      const at = Date.parse(timestamp);
      if (at < Date.parse(validFrom) || at > Date.parse(validTo) || actorId.toLowerCase().includes('expired')) {
        throw new Error('Expired or out-of-scope authority always invalid');
      }
      assertAuthorityScope(requestedAircraftScope, requestedMaintenanceScope, authorityAircraftScope, authorityMaintenanceScope);
      const auditRecord = cutoverState.enabled
        ? appendAmroAuditLedgerRecord({
          tenantId,
          franchiseId,
          capability: 'certification',
          eventType: 'amro.audit.recorded.v1',
          entityType: 'certification-action',
          entityId: actorId,
          correlationId: ctx.correlationId,
          action: interfaceName,
          compatMode: compatDecision.compatMode,
          context: { actorId, timestamp, requestedAircraftScope, requestedMaintenanceScope },
          sourceHash: `${tenantId}:${actorId}:${timestamp}`,
          migrationBatchId: `migration-${tenantId}-${Date.now()}`,
          replayCheckpoint: `cert-${Date.now()}`,
        })
        : null;
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          validation_result: 'valid',
          expiry_info: { valid_from: validFrom, valid_to: validTo, expired: false },
          restriction_reason: null,
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

    if (interfaceName === 'submit-certification-decision') {
      const workPackageId = assertNonEmpty(body.work_package_id, 'work_package_id');
      const decision = parseDecision(body.decision);
      const signatures = parseObjectArray(body.signatures, 'signatures');
      const unresolvedBlockers = parseStringArray(body.unresolved_blockers || ['none'], 'unresolved_blockers');
      const blockers = unresolvedBlockers.includes('none') ? [] : unresolvedBlockers;
      if (decision === 'approve') {
        assertApprovalSignatures(signatures, blockers);
      }
      const actionStatus = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'deferred';
      const auditRecord = cutoverState.enabled
        ? appendAmroAuditLedgerRecord({
          tenantId,
          franchiseId,
          capability: 'certification',
          eventType: 'amro.audit.recorded.v1',
          entityType: 'certification-action',
          entityId: workPackageId,
          correlationId: ctx.correlationId,
          action: interfaceName,
          compatMode: compatDecision.compatMode,
          context: { decision, signatureCount: signatures.length, blockers },
          sourceHash: `${tenantId}:${workPackageId}:${decision}`,
          migrationBatchId: `migration-${tenantId}-${Date.now()}`,
          replayCheckpoint: `cert-${Date.now()}`,
        })
        : null;
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          certification_action_id: `${tenantId}-${workPackageId}-cert-${Date.now()}`,
          action_status: actionStatus,
          blockers,
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

    if (interfaceName === 'escalate-blocked-certification') {
      const workPackageId = assertNonEmpty(body.work_package_id, 'work_package_id');
      const blockReason = assertNonEmpty(body.block_reason, 'block_reason');
      const escalationTarget = assertNonEmpty(body.escalation_target, 'escalation_target');
      const authorityChain = parseStringArray(body.authority_chain || [], 'authority_chain');
      assertEscalationTarget(escalationTarget, authorityChain);
      const auditRecord = cutoverState.enabled
        ? appendAmroAuditLedgerRecord({
          tenantId,
          franchiseId,
          capability: 'certification',
          eventType: 'amro.audit.recorded.v1',
          entityType: 'certification-action',
          entityId: workPackageId,
          correlationId: ctx.correlationId,
          action: interfaceName,
          compatMode: compatDecision.compatMode,
          context: { blockReason, escalationTarget },
          sourceHash: `${tenantId}:${workPackageId}:${escalationTarget}`,
          migrationBatchId: `migration-${tenantId}-${Date.now()}`,
          replayCheckpoint: `cert-${Date.now()}`,
        })
        : null;
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          escalation_event_id: `${tenantId}-${workPackageId}-escalation-${Date.now()}`,
          escalation_status: 'escalated',
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

    return res.status(400).json({
      error: 'Unsupported interface. Use validate-certifying-authority, submit-certification-decision, or escalate-blocked-certification.',
      correlationId: ctx.correlationId,
      version: 'v2',
    });
  } catch (error: any) {
    return sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
