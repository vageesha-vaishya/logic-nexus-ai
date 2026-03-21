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
  logApiEvent,
  resolveAndApplyAccessContext,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import {
  adaptLegacyComplianceGates,
  adaptModuleComplianceGatesFromLegacy,
  buildAmroIntegrationContractEnvelope,
  buildAmroServiceBoundaryEnvelope,
  createAmroIsolationScope,
  enforceAmroScopedLegacyRows,
  type ComplianceDecision,
  type ComplianceGateItem,
  type LegacyComplianceGateRow,
} from './anti-corruption-adapter';
import {
  buildHistoricalBackfillMetadata,
  drainAmroReconciliationQueueForFallback,
  enqueueAmroDualWriteOperation,
  enqueueAmroReconciliationSnapshot,
} from './reconciliation-queue';
import { appendAmroAuditLedgerRecord } from './audit-ledger';
import { resolveAmroAuditLedgerCutoverState, resolveAmroV2EndpointRolloutState } from './audit-ledger-cutover';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isV2Enabled(): boolean {
  return parseBoolean(process.env.AMRO_COMPLIANCE_GATES_V2_ENABLED, false);
}

function isDualRunEnabled(): boolean {
  return parseBoolean(process.env.AMRO_COMPLIANCE_GATES_DUAL_RUN, true);
}

function isLegacyFallbackEnabled(): boolean {
  return parseBoolean(process.env.AMRO_V2_LEGACY_FALLBACK_ENABLED, false)
    || parseBoolean(process.env.AMRO_COMPLIANCE_GATES_LEGACY_FALLBACK_ENABLED, false);
}

function parseDecisionFilter(req: ApiRequest): ComplianceDecision | null {
  const value = Array.isArray(req.query.decision) ? req.query.decision[0] : req.query.decision;
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'approved' || normalized === 'rejected' || normalized === 'pending') {
    return normalized;
  }
  throw new Error('Bad Request: Invalid decision filter');
}

function buildLegacyComplianceGateRows(tenantId: string, franchiseId: string | null): LegacyComplianceGateRow[] {
  return [
    {
      legacy_gate_id: 'legacy-gate-001',
      work_package_id: 'WP-001',
      task_code: 'T-001',
      decision: 'pending',
      decided_by: null,
      decided_at: null,
      tenant_id: tenantId,
      franchise_id: franchiseId,
      domain_id: 'amro',
      version: 'v2',
    },
    {
      legacy_gate_id: 'legacy-gate-002',
      work_package_id: 'WP-001',
      task_code: 'T-002',
      decision: 'approved',
      decided_by: 'certifier-a',
      decided_at: '2026-03-20T10:30:00.000Z',
      tenant_id: tenantId,
      franchise_id: franchiseId,
      domain_id: 'amro',
      version: 'v2',
    },
    {
      legacy_gate_id: 'legacy-gate-003',
      work_package_id: 'WP-002',
      task_code: 'T-003',
      decision: 'rejected',
      decided_by: 'certifier-b',
      decided_at: '2026-03-20T09:00:00.000Z',
      tenant_id: tenantId,
      franchise_id: franchiseId,
      domain_id: 'amro',
      version: 'v2',
    },
  ];
}

function filterByDecision(items: ComplianceGateItem[], decision: ComplianceDecision | null): ComplianceGateItem[] {
  if (!decision) return items;
  return items.filter((item) => item.decision === decision);
}

const ALLOWED_REGULATOR_PROFILES = new Set(['faa', 'easa', 'caac']);
const ALLOWED_EXCEPTION_REQUEST_ROLES = new Set(['tenant_admin', 'inspector', 'engineer']);
const MANDATORY_DOSSIER_ARTIFACTS: Record<string, ReadonlyArray<string>> = {
  faa: ['release_certificate', 'task_cards', 'signature_log'],
  easa: ['release_certificate', 'task_cards', 'signature_log'],
  caac: ['release_certificate', 'task_cards', 'signature_log'],
};

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

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function parseIsoTimestamp(value: unknown, fieldName: string): string {
  const normalized = assertNonEmpty(value, fieldName);
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid ISO datetime`);
  }
  return new Date(parsed).toISOString();
}

function resolveComplianceDecision(requiredObligations: Array<Record<string, unknown>>) {
  const blockers = requiredObligations
    .filter((obligation) => obligation.fulfilled !== true)
    .map((obligation) => ({
      obligation_id: String(obligation.obligation_id || ''),
      reason: String(obligation.reason || 'obligation not fulfilled'),
    }))
    .filter((blocker) => blocker.obligation_id);
  const decision = blockers.length === 0 ? 'pass' : 'fail';
  return { decision, blockers };
}

function buildReconciliation(legacyItems: ComplianceGateItem[], moduleItems: ComplianceGateItem[]) {
  const legacyKeys = new Set(legacyItems.map((item) => `${item.workPackageId}:${item.taskCode}`));
  const moduleKeys = new Set(moduleItems.map((item) => `${item.workPackageId}:${item.taskCode}`));
  const missingInModule = legacyItems
    .filter((item) => !moduleKeys.has(`${item.workPackageId}:${item.taskCode}`))
    .map((item) => `${item.workPackageId}:${item.taskCode}`);
  const missingInLegacy = moduleItems
    .filter((item) => !legacyKeys.has(`${item.workPackageId}:${item.taskCode}`))
    .map((item) => `${item.workPackageId}:${item.taskCode}`);
  return {
    legacyCount: legacyItems.length,
    moduleCount: moduleItems.length,
    deltaCount: Math.abs(legacyItems.length - moduleItems.length) + missingInLegacy.length + missingInModule.length,
    missingInModule,
    missingInLegacy,
  };
}

function buildDefaultReconciliationForAudit(legacyItems: ComplianceGateItem[], moduleItems: ComplianceGateItem[]) {
  if (legacyItems.length || moduleItems.length) {
    return buildReconciliation(legacyItems, moduleItems);
  }
  return {
    legacyCount: 0,
    moduleCount: 0,
    deltaCount: 0,
    missingInModule: [],
    missingInLegacy: [],
  };
}

function appendComplianceGateAuditRecord(params: {
  tenantId: string;
  franchiseId: string | null;
  correlationId: string;
  compatMode: string;
  decision: ComplianceDecision | null;
  mode: 'dual-run' | 'module' | 'legacy-fallback';
  legacyItems: ComplianceGateItem[];
  moduleItems: ComplianceGateItem[];
  queueMode: 'redis' | 'memory' | 'disabled' | null;
  snapshotCheckpoint: string | null;
}) {
  const reconciliation = buildDefaultReconciliationForAudit(params.legacyItems, params.moduleItems);
  const historicalBackfill = buildHistoricalBackfillMetadata({
    capability: 'compliance-gates',
    correlationId: params.correlationId,
    tenantId: params.tenantId,
    franchiseId: params.franchiseId,
    compatMode: params.compatMode,
    requestedFilters: { decision: params.decision },
    reconciliation,
  });

  return appendAmroAuditLedgerRecord({
    tenantId: params.tenantId,
    franchiseId: params.franchiseId,
    capability: 'compliance-gates',
    eventType: 'amro.audit.recorded.v1',
    entityType: 'compliance-gate',
    entityId: params.decision ? `decision:${params.decision}` : 'decision:all',
    correlationId: params.correlationId,
    action: `${params.mode}.read`,
    compatMode: params.compatMode,
    sourceHash: historicalBackfill.sourceHash,
    migrationBatchId: historicalBackfill.migrationBatchId,
    replayCheckpoint: params.snapshotCheckpoint || historicalBackfill.replayCheckpoint,
    context: {
      mode: params.mode,
      requestedFilters: { decision: params.decision },
      queueMode: params.queueMode,
      reconciliation,
    },
  });
}

async function enqueueComplianceDualWriteOperations(params: {
  tenantId: string;
  franchiseId: string | null;
  correlationId: string;
  compatMode: string;
  items: ComplianceGateItem[];
}) {
  const approvedItems = params.items.filter((item) => item.decision === 'approved');
  const operations = await Promise.all(
    approvedItems.map(async (item) => {
      const result = await enqueueAmroDualWriteOperation({
        capability: 'compliance-gates',
        tenantId: params.tenantId,
        franchiseId: params.franchiseId,
        compatMode: params.compatMode,
        correlationId: params.correlationId,
        entityType: 'compliance-gate',
        entityId: item.gateId,
        eventType: 'amro.compliance.gate_decided.v1',
        action: 'gate-sync',
      });
      return {
        entityId: item.gateId,
        eventType: 'amro.compliance.gate_decided.v1',
        idempotencyKey: result.idempotencyKey,
        queueMode: result.queueMode,
      };
    })
  );
  return {
    enabled: true,
    approvedEntityCount: approvedItems.length,
    operations,
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const initialDecision = resolveGatewayCompatibility(req);
  applyCompatibilityResponseHeaders(res, initialDecision, ctx.correlationId);

  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed`, correlationId: ctx.correlationId, version: 'v2' });
    }

    if (!isV2Enabled()) {
      return res.status(404).json({
        error: 'AMRO compliance-gates v2 endpoint is disabled',
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
    const decision = parseDecisionFilter(req);
    const tenantId = String(access.tenantId || '');
    const franchiseId = access.franchiseId ? String(access.franchiseId) : null;
    const isolationScope = createAmroIsolationScope(tenantId, franchiseId);
    const serviceBoundaries = buildAmroServiceBoundaryEnvelope({
      capability: 'compliance-gates',
      scope: isolationScope,
      subscriptionStatus: amroAccess.subscriptionStatus,
      validatedAt: amroAccess.validatedAt,
    });
    const rolloutState = resolveAmroV2EndpointRolloutState({
      tenantId,
      franchiseId,
      capability: 'compliance-gates',
    });
    if (!rolloutState.enabled) {
      return res.status(404).json({
        error: 'AMRO compliance-gates v2 endpoint is not enabled for this rollout cohort',
        endpointRollout: rolloutState,
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }
    const cutoverState = resolveAmroAuditLedgerCutoverState({
      tenantId,
      franchiseId,
      capability: 'compliance-gates',
    });
    const interfaceName = String(req.query.interface || '').trim().toLowerCase();

    if (req.method === 'POST' && interfaceName === 'evaluate-compliance-gate') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const body = parseBody(req.body);
      const context = parseBody(body.context);
      const contextType = assertNonEmpty(context.type, 'context.type').toLowerCase();
      if (contextType !== 'work_package' && contextType !== 'task') {
        throw new Error('context must be work_package or task');
      }
      const contextId = assertNonEmpty(context.id, 'context.id');
      const regulatorProfile = assertNonEmpty(body.regulator_profile, 'regulator_profile').toLowerCase();
      if (!ALLOWED_REGULATOR_PROFILES.has(regulatorProfile)) {
        throw new Error('regulator_profile is not supported');
      }
      const obligationsRaw = Array.isArray(body.required_obligations) ? body.required_obligations : [];
      if (obligationsRaw.length === 0) {
        throw new Error('required_obligations must include at least one obligation');
      }
      const requiredObligations = obligationsRaw.map((entry) => (entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}));
      assertNonEmpty(body.policy_version_snapshot, 'policy_version_snapshot');
      assertNonEmpty(body.decision_evidence, 'decision_evidence');
      const resolved = resolveComplianceDecision(requiredObligations);
      return res.status(200).json({
        version: 'v2',
        interface: 'evaluate-compliance-gate',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        input: {
          context: { type: contextType, id: contextId },
          regulator_profile: regulatorProfile,
          required_obligations: requiredObligations,
        },
        output: {
          decision: resolved.decision,
          blockers: resolved.blockers,
          rationale: resolved.decision === 'pass'
            ? 'All required obligations satisfied'
            : 'One or more obligations are unresolved',
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'register-exception-request') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const role = String(ctx.role || '').trim().toLowerCase();
      if (!ALLOWED_EXCEPTION_REQUEST_ROLES.has(role)) {
        throw new Error('only allowed roles may request exception');
      }
      const body = parseBody(req.body);
      const workPackageId = assertNonEmpty(body.work_package_id, 'work_package_id');
      const obligationId = assertNonEmpty(body.obligation_id, 'obligation_id');
      const justification = assertNonEmpty(body.justification, 'justification');
      const requestedBy = assertNonEmpty(body.requested_by, 'requested_by');
      const slaDueAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      return res.status(200).json({
        version: 'v2',
        interface: 'register-exception-request',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        input: {
          work_package_id: workPackageId,
          obligation_id: obligationId,
          justification,
          requested_by: requestedBy,
        },
        output: {
          exception_id: `${tenantId}-${workPackageId}-exception-${Date.now()}`,
          review_status: 'pending_review',
          sla_due_at: slaDueAt,
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'generate-compliance-dossier') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const body = parseBody(req.body);
      const workPackageId = assertNonEmpty(body.work_package_id, 'work_package_id');
      const profile = assertNonEmpty(body.profile, 'profile').toLowerCase();
      if (!ALLOWED_REGULATOR_PROFILES.has(profile)) {
        throw new Error('profile must be FAA, EASA, or CAAC');
      }
      const includeArtifacts = parseStringArray(body.include_artifacts);
      const mandatoryArtifacts = MANDATORY_DOSSIER_ARTIFACTS[profile] || [];
      const missingMandatory = mandatoryArtifacts.filter((artifact) => !includeArtifacts.includes(artifact));
      if (missingMandatory.length > 0) {
        throw new Error('All mandatory artifacts must be present before dossier finalization');
      }
      return res.status(200).json({
        version: 'v2',
        interface: 'generate-compliance-dossier',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        input: {
          work_package_id: workPackageId,
          profile,
          include_artifacts: includeArtifacts,
        },
        output: {
          dossier_id: `${tenantId}-${workPackageId}-dossier-${Date.now()}`,
          dossier_status: 'finalized',
          artifact_manifest: includeArtifacts.map((artifact) => ({
            artifact,
            collected_at: parseIsoTimestamp(new Date().toISOString(), 'collected_at'),
          })),
        },
      });
    }

    if (req.method === 'POST') {
      return res.status(400).json({
        error: 'Unsupported interface. Use evaluate-compliance-gate, register-exception-request, or generate-compliance-dossier.',
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }

    const dualRun = isDualRunEnabled();
    const legacyFallback = isLegacyFallbackEnabled();
    const legacyRows = enforceAmroScopedLegacyRows(buildLegacyComplianceGateRows(tenantId, franchiseId), isolationScope);
    const moduleItems = filterByDecision(adaptModuleComplianceGatesFromLegacy(legacyRows), decision);
    const legacyItems = filterByDecision(adaptLegacyComplianceGates(legacyRows), decision);
    const integrationContracts = buildAmroIntegrationContractEnvelope({
      capability: 'compliance-gates',
      tenantId,
      franchiseId,
      endpointRollout: rolloutState,
      auditLedgerCutover: cutoverState,
    });
    const reconciliation = buildReconciliation(legacyItems, moduleItems);
    const deterministicComparison = buildHistoricalBackfillMetadata({
      capability: 'compliance-gates',
      correlationId: ctx.correlationId,
      tenantId,
      franchiseId,
      compatMode: compatDecision.compatMode,
      requestedFilters: { decision },
      reconciliation,
    });
    const dualWrite = await enqueueComplianceDualWriteOperations({
      tenantId,
      franchiseId,
      correlationId: ctx.correlationId,
      compatMode: compatDecision.compatMode,
      items: moduleItems,
    });

    if (legacyFallback) {
      const fallback = await drainAmroReconciliationQueueForFallback({
        capability: 'compliance-gates',
        correlationId: ctx.correlationId,
        tenantId,
        franchiseId,
        compatMode: compatDecision.compatMode,
      });
      const auditRecord = cutoverState.enabled
        ? appendComplianceGateAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          decision,
          mode: 'legacy-fallback',
          legacyItems,
          moduleItems,
          queueMode: fallback.queueMode,
          snapshotCheckpoint: fallback.snapshotCheckpoint,
        })
        : null;
      if (auditRecord) {
        logApiEvent('info', '[AmroComplianceGatesV2] audit ledger appended', {
          correlationId: ctx.correlationId,
          tenantId,
          franchiseId,
          mode: 'legacy-fallback',
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        });
      }
      return res.status(200).json({
        version: 'v2',
        compatMode: compatDecision.compatMode,
        mode: 'legacy-fallback',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        integrationContracts,
        coexistence: {
          dualRead: {
            deterministicComparisonHash: deterministicComparison.sourceHash,
            replayCheckpoint: deterministicComparison.replayCheckpoint,
            reconciliation,
          },
          dualWrite,
        },
        filters: { decision },
        fallback: {
          legacyMode: true,
          queueDrained: fallback.drained,
          queueMode: fallback.queueMode,
          snapshotCheckpoint: fallback.snapshotCheckpoint,
          snapshotCheckpointRestore: {
            checkpoint: fallback.snapshotCheckpoint,
            restored: true,
          },
        },
        endpointRollout: rolloutState,
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
        data: { complianceGates: legacyItems },
        correlationId: ctx.correlationId,
      });
    }

    if (!dualRun) {
      const auditRecord = cutoverState.enabled
        ? appendComplianceGateAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          decision,
          mode: 'module',
          legacyItems,
          moduleItems,
          queueMode: null,
          snapshotCheckpoint: null,
        })
        : null;
      if (auditRecord) {
        logApiEvent('info', '[AmroComplianceGatesV2] audit ledger appended', {
          correlationId: ctx.correlationId,
          tenantId,
          franchiseId,
          mode: 'module',
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        });
      }
      return res.status(200).json({
        version: 'v2',
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        integrationContracts,
        coexistence: {
          dualRead: {
            deterministicComparisonHash: deterministicComparison.sourceHash,
            replayCheckpoint: deterministicComparison.replayCheckpoint,
            reconciliation,
          },
          dualWrite,
        },
        filters: { decision },
        endpointRollout: rolloutState,
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
        data: { complianceGates: moduleItems },
        correlationId: ctx.correlationId,
      });
    }

    const queueResult = await enqueueAmroReconciliationSnapshot({
      capability: 'compliance-gates',
      correlationId: ctx.correlationId,
      tenantId,
      franchiseId,
      compatMode: compatDecision.compatMode,
      requestedFilters: { decision },
      reconciliation,
    });
    logApiEvent('info', '[AmroComplianceGatesV2] dual-run reconciliation', {
      correlationId: ctx.correlationId,
      tenantId,
      franchiseId,
      compatMode: compatDecision.compatMode,
      decision,
      reconciliation,
      queue: queueResult,
    });
    const auditRecord = cutoverState.enabled
      ? appendComplianceGateAuditRecord({
        tenantId,
        franchiseId,
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        decision,
        mode: 'dual-run',
        legacyItems,
        moduleItems,
        queueMode: queueResult.queueMode,
        snapshotCheckpoint: null,
      })
      : null;
    if (auditRecord) {
      logApiEvent('info', '[AmroComplianceGatesV2] audit ledger appended', {
        correlationId: ctx.correlationId,
        tenantId,
        franchiseId,
        mode: 'dual-run',
        eventType: auditRecord.eventType,
        recordId: auditRecord.recordId,
        chainHash: auditRecord.chainHash,
        replayCheckpoint: auditRecord.replayCheckpoint,
      });
    }

    return res.status(200).json({
      version: 'v2',
      compatMode: compatDecision.compatMode,
      mode: 'dual-run',
      domainAccess: {
        subscriptionStatus: amroAccess.subscriptionStatus,
        source: amroAccess.source,
        validatedAt: amroAccess.validatedAt,
      },
      serviceBoundaries,
      integrationContracts,
      coexistence: {
        dualRead: {
          deterministicComparisonHash: deterministicComparison.sourceHash,
          replayCheckpoint: deterministicComparison.replayCheckpoint,
          reconciliation,
        },
        dualWrite,
      },
      filters: { decision },
      data: { complianceGates: moduleItems },
      legacy: { complianceGates: legacyItems },
      reconciliation,
      queue: queueResult,
      endpointRollout: rolloutState,
      auditLedgerCutover: cutoverState,
      auditLedger: auditRecord ? {
        eventType: auditRecord.eventType,
        recordId: auditRecord.recordId,
        chainHash: auditRecord.chainHash,
        replayCheckpoint: auditRecord.replayCheckpoint,
      } : null,
      correlationId: ctx.correlationId,
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
