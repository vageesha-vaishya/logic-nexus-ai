import { createHash } from 'node:crypto';
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
import { appendAmroAuditLedgerRecord, replayAmroAuditLedgerRecords } from './audit-ledger';
import { resolveAmroAuditLedgerCutoverState, resolveAmroV2EndpointRolloutState } from './audit-ledger-cutover';
import { enforceAmroSequentialMilestoneForComplianceInterface } from './phase-plan-model';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function parseBodyBoolean(value: unknown, fallback: boolean): boolean {
  return parseBoolean(String(value ?? ''), fallback);
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
const ALLOWED_OBLIGATION_TYPES = new Set(['ad', 'sb']);
const ALLOWED_DEFERRAL_TYPES = new Set(['mel', 'cdl']);
const ALLOWED_DEFERRAL_CATEGORIES = new Set(['A', 'B', 'C', 'D']);
const ALLOWED_AUDIT_REPLAY_CAPABILITIES = new Set(['work-packages', 'tasks', 'compliance-gates']);
const ALLOWED_EXPORT_FORMATS = new Set(['csv', 'json']);
const REGULATOR_COMPLIANCE_PROFILES = {
  faa: {
    profile: 'FAA',
    requiredControls: [
      'airworthiness_compliance',
      'certifying_release_authority',
      'maintenance_records_integrity',
    ],
    dataArtifacts: ['ad_linkage', 'rts_decisions', 'signer_credentials'],
  },
  easa: {
    profile: 'EASA',
    requiredControls: [
      'continuing_airworthiness_records',
      'certifying_staff_validity',
      'task_evidence_traceability',
    ],
    dataArtifacts: ['compliance_dossiers', 'qualification_evidence'],
  },
  caac: {
    profile: 'CAAC',
    requiredControls: [
      'local_operational_oversight',
      'maintenance_qualification_checks',
      'maintenance_event_completeness',
    ],
    dataArtifacts: ['regulator_profile_mapping', 'localized_obligation_records'],
  },
} as const;
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

function assertScopeRequired(tenantId: string, franchiseId: string | null) {
  if (!tenantId || !franchiseId) {
    throw new Error('tenant and franchise scope are required');
  }
}

function assertOptionalScopedIdentifier(value: string, tenantId: string, fieldName: string) {
  const normalized = String(value || '').trim();
  if (!normalized || !normalized.includes(':')) {
    return;
  }
  const [scopedTenant] = normalized.split(':', 1);
  if (scopedTenant !== tenantId) {
    throw new Error(`${fieldName} must be scoped to tenant ${tenantId}`);
  }
}

function assertOptionalScopeContext(body: Record<string, unknown>, tenantId: string, franchiseId: string | null) {
  const scopeTenantId = String(body.scope_tenant_id || '').trim();
  const scopeFranchiseId = String(body.scope_franchise_id || '').trim();
  if (scopeTenantId && scopeTenantId !== tenantId) {
    throw new Error('scope_tenant_id does not match authenticated tenant scope');
  }
  if (scopeFranchiseId && scopeFranchiseId !== String(franchiseId || '')) {
    throw new Error('scope_franchise_id does not match authenticated franchise scope');
  }
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

function buildEvidenceLinkHash(input: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function buildActorAttribution(userId: string, role: string) {
  return {
    actor_id: String(userId || 'unknown'),
    actor_role: String(role || 'unknown'),
    actor_at: new Date().toISOString(),
  };
}

function getRegulatorComplianceProfile(profile: 'faa' | 'easa' | 'caac') {
  return REGULATOR_COMPLIANCE_PROFILES[profile];
}

function resolveComplianceDecision(requiredObligations: Array<Record<string, unknown>>, options: {
  melCdlWindowValid: boolean;
  deferralAuthorityValid: boolean;
  assignedActorPrivilegesValid: boolean;
  evidenceComplete: boolean;
  policySnapshotActive: boolean;
}) {
  const mandatoryDirectiveBlockers = requiredObligations
    .filter((obligation) => obligation.fulfilled !== true)
    .map((obligation) => ({
      obligation_id: String(obligation.obligation_id || ''),
      reason: String(obligation.reason || 'obligation not fulfilled'),
    }))
    .filter((blocker) => blocker.obligation_id);
  const blockers = [
    ...mandatoryDirectiveBlockers,
    ...(options.melCdlWindowValid && options.deferralAuthorityValid ? [] : [{
      obligation_id: 'mel-cdl-deferral',
      reason: 'MEL/CDL deferral validation failed',
    }]),
    ...(options.assignedActorPrivilegesValid ? [] : [{
      obligation_id: 'qualification-validity',
      reason: 'Assigned actor privileges do not satisfy release requirements',
    }]),
    ...(options.evidenceComplete ? [] : [{
      obligation_id: 'evidence-completeness',
      reason: 'Mandatory signatures or attachments are missing',
    }]),
    ...(options.policySnapshotActive ? [] : [{
      obligation_id: 'policy-versioning',
      reason: 'Policy snapshot is stale and requires refresh',
    }]),
  ];
  const decision = blockers.length === 0 ? 'pass' : 'fail';
  return {
    decision,
    blockers,
    rule_clusters: [
      {
        cluster: 'ad-sb-mandatory',
        passed: mandatoryDirectiveBlockers.length === 0,
        guidance: mandatoryDirectiveBlockers.length === 0
          ? 'All mandatory directives are closed'
          : 'Present unresolved directive IDs and required corrective actions',
      },
      {
        cluster: 'mel-cdl-deferral',
        passed: options.melCdlWindowValid && options.deferralAuthorityValid,
        guidance: options.melCdlWindowValid && options.deferralAuthorityValid
          ? 'Deferral policy remains valid'
          : 'Use the allowed deferral path and resolve authority or expiry constraints',
      },
      {
        cluster: 'qualification-validity',
        passed: options.assignedActorPrivilegesValid,
        guidance: options.assignedActorPrivilegesValid
          ? 'Assigned actors meet privilege requirements'
          : 'Assign certified alternate personnel and re-run gate',
      },
      {
        cluster: 'evidence-completeness',
        passed: options.evidenceComplete,
        guidance: options.evidenceComplete
          ? 'Signatures and attachments are complete'
          : 'Show missing evidence checklist before release',
      },
      {
        cluster: 'policy-versioning',
        passed: options.policySnapshotActive,
        guidance: options.policySnapshotActive
          ? 'Active policy snapshot validated'
          : 'Refresh policy snapshot and re-evaluate gate',
      },
    ],
  };
}

function parseInteger(value: unknown, fieldName: string): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }
  return parsed;
}

function parseNumber(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  return parsed;
}

function buildRegulatorProfilePack(profile: 'faa' | 'easa' | 'caac') {
  const profileDefinition = getRegulatorComplianceProfile(profile);
  if (profile === 'faa') {
    return {
      profile: profileDefinition.profile,
      obligations: ['14CFR-39-AD-tracking', 'part-145-release-to-service', 'maintenance-record-append-only'],
      melPolicy: { maxDeferralCategoryAHours: 24, maxDeferralCategoryBHours: 72 },
      gateRules: ['faa-signature-chain-valid', 'faa-mandatory-ad-closed'],
      required_controls: profileDefinition.requiredControls,
      data_artifacts: profileDefinition.dataArtifacts,
    };
  }
  if (profile === 'easa') {
    return {
      profile: profileDefinition.profile,
      obligations: ['part-m-subpart-g-closure', 'part-145-certifying-staff-check', 'camo-deviation-evidence'],
      melPolicy: { maxDeferralCategoryAHours: 24, maxDeferralCategoryBHours: 72 },
      gateRules: ['easa-form-1-linked', 'easa-mel-cdl-policy-pass'],
      required_controls: profileDefinition.requiredControls,
      data_artifacts: profileDefinition.dataArtifacts,
    };
  }
  return {
    profile: profileDefinition.profile,
    obligations: ['ccar145-release-signoff', 'ccar66-license-verification', 'caac-ad-sb-traceability'],
    melPolicy: { maxDeferralCategoryAHours: 24, maxDeferralCategoryBHours: 72 },
    gateRules: ['caac-closure-criteria-pass', 'caac-airworthiness-directive-satisfied'],
    required_controls: profileDefinition.requiredControls,
    data_artifacts: profileDefinition.dataArtifacts,
  };
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

function appendComplianceMutationAuditRecord(params: {
  tenantId: string;
  franchiseId: string | null;
  correlationId: string;
  compatMode: string;
  interfaceName: string;
  entityId: string;
  context: Record<string, unknown>;
  actorId: string;
  actorRole: string;
}) {
  const actorAttribution = buildActorAttribution(params.actorId, params.actorRole);
  return appendAmroAuditLedgerRecord({
    tenantId: params.tenantId,
    franchiseId: params.franchiseId,
    capability: 'compliance-gates',
    eventType: 'amro.audit.recorded.v1',
    entityType: 'compliance-gate',
    entityId: params.entityId,
    correlationId: params.correlationId,
    action: params.interfaceName,
    compatMode: params.compatMode,
    sourceHash: `${params.tenantId}:${params.interfaceName}:${params.entityId}:${params.correlationId}`,
    migrationBatchId: `runtime:${params.tenantId}:${params.franchiseId || 'franchise-none'}`,
    replayCheckpoint: `mutation:${Date.now()}`,
    context: {
      ...params.context,
      actor: actorAttribution,
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
    if (req.method === 'POST') {
      enforceAmroSequentialMilestoneForComplianceInterface(interfaceName);
    }

    if (req.method === 'POST' && interfaceName === 'evaluate-compliance-gate') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const body = parseBody(req.body);
      assertScopeRequired(tenantId, franchiseId);
      assertOptionalScopeContext(body, tenantId, franchiseId);
      const context = parseBody(body.context);
      const contextType = assertNonEmpty(context.type, 'context.type').toLowerCase();
      if (contextType !== 'work_package' && contextType !== 'task') {
        throw new Error('context must be work_package or task');
      }
      const contextId = assertNonEmpty(context.id, 'context.id');
      assertOptionalScopedIdentifier(contextId, tenantId, 'context.id');
      const regulatorProfile = assertNonEmpty(body.regulator_profile, 'regulator_profile').toLowerCase();
      if (!ALLOWED_REGULATOR_PROFILES.has(regulatorProfile)) {
        throw new Error('regulator_profile is not supported');
      }
      const obligationsRaw = Array.isArray(body.required_obligations) ? body.required_obligations : [];
      if (obligationsRaw.length === 0) {
        throw new Error('required_obligations must include at least one obligation');
      }
      const requiredObligations = obligationsRaw.map((entry) => (entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}));
      const policyVersionSnapshot = assertNonEmpty(body.policy_version_snapshot, 'policy_version_snapshot');
      const decisionEvidence = assertNonEmpty(body.decision_evidence, 'decision_evidence');
      const melCdlWindowValid = parseBodyBoolean(body.mel_cdl_window_valid, true);
      const deferralAuthorityValid = parseBodyBoolean(body.deferral_authority_valid, true);
      const assignedActorPrivilegesValid = parseBodyBoolean(body.assigned_actor_privileges_valid, true);
      const mandatorySignaturesPresent = parseBodyBoolean(body.mandatory_signatures_present, true);
      const mandatoryAttachmentsPresent = parseBodyBoolean(body.mandatory_attachments_present, true);
      const policySnapshotActive = parseBodyBoolean(body.policy_snapshot_active, true);
      const evidenceComplete = mandatorySignaturesPresent && mandatoryAttachmentsPresent;
      const actorAttribution = buildActorAttribution(ctx.userId, ctx.role);
      const evidenceLinkHash = buildEvidenceLinkHash({
        tenant_id: tenantId,
        franchise_id: franchiseId,
        context: { type: contextType, id: contextId },
        regulator_profile: regulatorProfile,
        policy_version_snapshot: policyVersionSnapshot,
        decision_evidence: decisionEvidence,
        obligations: requiredObligations,
      });
      const resolved = resolveComplianceDecision(requiredObligations, {
        melCdlWindowValid,
        deferralAuthorityValid,
        assignedActorPrivilegesValid,
        evidenceComplete,
        policySnapshotActive,
      });
      const auditRecord = cutoverState.enabled
        ? appendComplianceMutationAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          interfaceName,
          entityId: contextId,
          context: {
            decision: resolved.decision,
            blockerCount: resolved.blockers.length,
            contextType,
            regulatorProfile,
            policyVersionSnapshot,
            decisionEvidence,
            evidenceLinkHash,
            traceability: {
              source_trigger: `${contextType}:${contextId}`,
              closure_decision: resolved.decision,
            },
          },
          actorId: ctx.userId,
          actorRole: ctx.role,
        })
        : null;
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
          rule_clusters: resolved.rule_clusters,
          rationale: resolved.decision === 'pass'
            ? 'All required obligations satisfied'
            : 'One or more obligations are unresolved',
          operator_guidance: resolved.rule_clusters
            .filter((cluster) => cluster.passed === false)
            .map((cluster) => cluster.guidance),
          auditability: {
            traceability: {
              source_trigger: `${contextType}:${contextId}`,
              closure_decision: resolved.decision,
            },
            evidence_link_hash: evidenceLinkHash,
            actor_attribution: actorAttribution,
          },
        },
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
      });
    }

    if (req.method === 'POST' && interfaceName === 'ingest-ad-sb-obligations') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const body = parseBody(req.body);
      assertScopeRequired(tenantId, franchiseId);
      assertOptionalScopeContext(body, tenantId, franchiseId);
      const workPackageId = assertNonEmpty(body.work_package_id, 'work_package_id');
      assertOptionalScopedIdentifier(workPackageId, tenantId, 'work_package_id');
      const regulatorProfile = assertNonEmpty(body.regulator_profile, 'regulator_profile').toLowerCase();
      if (!ALLOWED_REGULATOR_PROFILES.has(regulatorProfile)) {
        throw new Error('regulator_profile is not supported');
      }
      const sourceAdapter = assertNonEmpty(body.source_adapter, 'source_adapter');
      const obligationsRaw = Array.isArray(body.obligations) ? body.obligations : [];
      if (obligationsRaw.length === 0) {
        throw new Error('obligations must include at least one AD/SB item');
      }
      const mappedObligations = obligationsRaw.map((entry, index) => {
        const item = parseBody(entry);
        const obligationId = assertNonEmpty(item.obligation_id, `obligations[${index}].obligation_id`);
        const obligationType = assertNonEmpty(item.obligation_type, `obligations[${index}].obligation_type`).toLowerCase();
        if (!ALLOWED_OBLIGATION_TYPES.has(obligationType)) {
          throw new Error('obligation_type must be ad or sb');
        }
        const referenceNumber = assertNonEmpty(item.reference_number, `obligations[${index}].reference_number`);
        const dueAt = parseIsoTimestamp(item.due_at, `obligations[${index}].due_at`);
        const applicability = parseBody(item.applicability);
        const applicabilityTarget = String(applicability.aircraft_id || applicability.component_id || '').trim();
        if (!applicabilityTarget) {
          throw new Error(`obligations[${index}].applicability must include aircraft_id or component_id`);
        }
        return {
          obligation_id: obligationId,
          obligation_type: obligationType,
          reference_number: referenceNumber,
          due_at: dueAt,
          mapped_target: applicabilityTarget,
          mapping_status: 'mapped',
        };
      });
      const output = {
        ingestion_id: `${tenantId}-${workPackageId}-obligation-ingest-${Date.now()}`,
        mapped_obligations: mappedObligations,
        mapping_summary: {
          total: mappedObligations.length,
          ad_count: mappedObligations.filter((item) => item.obligation_type === 'ad').length,
          sb_count: mappedObligations.filter((item) => item.obligation_type === 'sb').length,
        },
      };
      const auditRecord = cutoverState.enabled
        ? appendComplianceMutationAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          interfaceName,
          entityId: workPackageId,
          context: {
            mappedCount: output.mapping_summary.total,
            sourceAdapter,
            regulatorProfile,
          },
          actorId: ctx.userId,
          actorRole: ctx.role,
        })
        : null;
      return res.status(200).json({
        version: 'v2',
        interface: 'ingest-ad-sb-obligations',
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
          regulator_profile: regulatorProfile,
          source_adapter: sourceAdapter,
        },
        output,
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
      });
    }

    if (req.method === 'POST' && interfaceName === 'pre-schedule-compliance-gate') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const body = parseBody(req.body);
      const workPackageId = assertNonEmpty(body.work_package_id, 'work_package_id');
      const aircraftStatus = assertNonEmpty(body.aircraft_status, 'aircraft_status').toLowerCase();
      const unresolvedObligations = parseStringArray(body.unresolved_mandatory_obligations);
      const blockedStatus = new Set(['grounded', 'airworthiness_hold', 'maintenance_blocked']);
      const decision = blockedStatus.has(aircraftStatus) || unresolvedObligations.length > 0 ? 'fail' : 'pass';
      const blockers = [
        blockedStatus.has(aircraftStatus) ? `aircraft status ${aircraftStatus} blocks scheduling` : '',
        ...unresolvedObligations.map((obligationId) => `mandatory obligation unresolved: ${obligationId}`),
      ].filter((value) => Boolean(value));
      const auditRecord = cutoverState.enabled
        ? appendComplianceMutationAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          interfaceName,
          entityId: workPackageId,
          context: {
            gate: 'pre-schedule',
            aircraftStatus,
            unresolvedMandatoryObligations: unresolvedObligations,
            decision,
            blockerCount: blockers.length,
          },
          actorId: ctx.userId,
          actorRole: ctx.role,
        })
        : null;
      return res.status(200).json({
        version: 'v2',
        interface: 'pre-schedule-compliance-gate',
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
          aircraft_status: aircraftStatus,
          unresolved_mandatory_obligations: unresolvedObligations,
        },
        output: {
          decision,
          blockers,
          gate: 'pre-schedule',
        },
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
      });
    }

    if (req.method === 'POST' && interfaceName === 'pre-execution-compliance-gate') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const body = parseBody(req.body);
      const taskId = assertNonEmpty(body.task_id, 'task_id');
      const technicianId = assertNonEmpty(body.technician_id, 'technician_id');
      const competencyValid = body.technician_competency_valid === true;
      const certificationValid = body.certification_valid === true;
      const decision = competencyValid && certificationValid ? 'pass' : 'fail';
      const blockers = [
        competencyValid ? '' : `technician competency invalid: ${technicianId}`,
        certificationValid ? '' : `technician certification invalid: ${technicianId}`,
      ].filter((value) => Boolean(value));
      const auditRecord = cutoverState.enabled
        ? appendComplianceMutationAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          interfaceName,
          entityId: taskId,
          context: {
            gate: 'pre-execution',
            technicianId,
            competencyValid,
            certificationValid,
            decision,
            blockerCount: blockers.length,
          },
          actorId: ctx.userId,
          actorRole: ctx.role,
        })
        : null;
      return res.status(200).json({
        version: 'v2',
        interface: 'pre-execution-compliance-gate',
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
          task_id: taskId,
          technician_id: technicianId,
          technician_competency_valid: competencyValid,
          certification_valid: certificationValid,
        },
        output: {
          decision,
          blockers,
          gate: 'pre-execution',
        },
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
      });
    }

    if (req.method === 'POST' && interfaceName === 'evaluate-mel-cdl-deferral') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const body = parseBody(req.body);
      const workPackageId = assertNonEmpty(body.work_package_id, 'work_package_id');
      const deferralType = assertNonEmpty(body.deferral_type, 'deferral_type').toLowerCase();
      if (!ALLOWED_DEFERRAL_TYPES.has(deferralType)) {
        throw new Error('deferral_type must be mel or cdl');
      }
      const itemReference = assertNonEmpty(body.item_reference, 'item_reference');
      const category = assertNonEmpty(body.deferral_category, 'deferral_category').toUpperCase();
      if (!ALLOWED_DEFERRAL_CATEGORIES.has(category)) {
        throw new Error('deferral_category must be A, B, C, or D');
      }
      const expiresAt = parseIsoTimestamp(body.expires_at, 'expires_at');
      const dispatchConditions = parseStringArray(body.dispatch_conditions);
      if (dispatchConditions.length === 0) {
        throw new Error('dispatch_conditions must include at least one condition');
      }
      const expiresInHours = Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 3600000));
      const decision = category === 'A' && expiresInHours < 24 ? 'reject' : 'approve';
      return res.status(200).json({
        version: 'v2',
        interface: 'evaluate-mel-cdl-deferral',
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
          deferral_type: deferralType,
          item_reference: itemReference,
          deferral_category: category,
          dispatch_conditions: dispatchConditions,
          expires_at: expiresAt,
        },
        output: {
          deferral_decision: decision,
          explainability: [
            { factor: 'deferral_category', value: category },
            { factor: 'hours_to_expiry', value: expiresInHours },
            { factor: 'dispatch_conditions', value: dispatchConditions.length },
          ],
          required_actions: decision === 'approve'
            ? ['capture-operational-briefing', 'schedule-next-review-checkpoint']
            : ['close-deferral-before-dispatch', 'escalate-to-compliance-duty-manager'],
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'load-compliance-gate-explainability') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const body = parseBody(req.body);
      const context = parseBody(body.context);
      const contextType = assertNonEmpty(context.type, 'context.type').toLowerCase();
      if (contextType !== 'work_package' && contextType !== 'task') {
        throw new Error('context must be work_package or task');
      }
      const contextId = assertNonEmpty(context.id, 'context.id');
      const policyVersionSnapshot = assertNonEmpty(body.policy_version_snapshot, 'policy_version_snapshot');
      const obligationsRaw = Array.isArray(body.required_obligations) ? body.required_obligations : [];
      if (obligationsRaw.length === 0) {
        throw new Error('required_obligations must include at least one obligation');
      }
      const requiredObligations = obligationsRaw.map((entry) => (entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}));
      const decision = resolveComplianceDecision(requiredObligations, {
        melCdlWindowValid: true,
        deferralAuthorityValid: true,
        assignedActorPrivilegesValid: true,
        evidenceComplete: true,
        policySnapshotActive: true,
      });
      return res.status(200).json({
        version: 'v2',
        interface: 'load-compliance-gate-explainability',
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
          policy_version_snapshot: policyVersionSnapshot,
        },
        output: {
          decision: decision.decision,
          gate_modal: {
            title: 'Compliance Gate Decision',
            status: decision.decision,
            blocker_count: decision.blockers.length,
          },
          explainability_panel: {
            policy_version_snapshot: policyVersionSnapshot,
            decision_path: [
              { step: 'obligation-ingestion', status: 'pass' },
              { step: 'rule-evaluation', status: decision.decision === 'pass' ? 'pass' : 'fail' },
              { step: 'release-gate', status: decision.decision === 'pass' ? 'pass' : 'blocked' },
            ],
            blockers: decision.blockers,
            rule_clusters: decision.rule_clusters,
          },
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'load-audit-replay-timeline') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const body = parseBody(req.body);
      const exportFilters = parseBody(body.export_filters);
      const capability = String(exportFilters.capability || 'compliance-gates').trim().toLowerCase();
      if (!ALLOWED_AUDIT_REPLAY_CAPABILITIES.has(capability)) {
        throw new Error('export_filters.capability is invalid');
      }
      const exportFormat = String(exportFilters.format || 'csv').trim().toLowerCase();
      if (!ALLOWED_EXPORT_FORMATS.has(exportFormat)) {
        throw new Error('export_filters.format must be csv or json');
      }
      const limit = Math.min(parseInteger(exportFilters.limit || 50, 'export_filters.limit'), 200);
      const actionFilter = String(exportFilters.action || '').trim().toLowerCase();
      const records = replayAmroAuditLedgerRecords({
        tenantId,
        franchiseId,
        capability: capability as 'work-packages' | 'tasks' | 'compliance-gates',
        limit,
      }).filter((record) => {
        if (!actionFilter) return true;
        return String(record.action || '').toLowerCase() === actionFilter;
      });
      const orderedEvents = records
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .map((record, index) => ({
          sequence: index + 1,
          record_id: record.recordId,
          action: record.action,
          created_at: record.createdAt,
        }));
      return res.status(200).json({
        version: 'v2',
        interface: 'load-audit-replay-timeline',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        mode: 'module',
        domainAccess: {
          subscriptionStatus: amroAccess.subscriptionStatus,
          source: amroAccess.source,
          validatedAt: amroAccess.validatedAt,
        },
        serviceBoundaries,
        output: {
          replay_timeline: {
            event_count: orderedEvents.length,
            events: orderedEvents,
            deterministic_sequence: 'created_at:asc',
          },
          export_filters: {
            capability,
            action: actionFilter || null,
            format: exportFormat,
            limit,
          },
          export_preview: {
            export_id: `${tenantId}-${capability}-audit-export-${Date.now()}`,
            format: exportFormat,
            row_count: orderedEvents.length,
          },
          policy_context: {
            policy_snapshots: Array.from(
              new Set(
                records
                  .map((record) => String((record.context || {}).policyVersionSnapshot || ''))
                  .filter(Boolean)
              )
            ),
            regulator_profiles: Array.from(
              new Set(
                records
                  .map((record) => String((record.context || {}).regulatorProfile || ''))
                  .filter(Boolean)
              )
            ),
          },
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'detect-compliance-anomalies') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const body = parseBody(req.body);
      const detectionWindow = assertNonEmpty(body.detection_window, 'detection_window');
      const reviewPopulation = parseInteger(body.review_population, 'review_population');
      const overdueObligations = parseInteger(body.overdue_obligations, 'overdue_obligations');
      const exceptionEscalations = parseInteger(body.exception_escalations, 'exception_escalations');
      const melCdlDeferralCount = parseInteger(body.mel_cdl_deferral_count, 'mel_cdl_deferral_count');
      const anomalyThreshold = parseNumber(body.anomaly_threshold || 0.2, 'anomaly_threshold');
      if (anomalyThreshold <= 0 || anomalyThreshold > 1) {
        throw new Error('anomaly_threshold must be between 0 and 1');
      }
      const alerts = [
        overdueObligations > Math.ceil(reviewPopulation * anomalyThreshold)
          ? { severity: 'high', code: 'overdue-obligations-spike', metric: overdueObligations }
          : null,
        exceptionEscalations > Math.ceil(reviewPopulation * anomalyThreshold)
          ? { severity: 'medium', code: 'exception-escalation-spike', metric: exceptionEscalations }
          : null,
        melCdlDeferralCount > Math.ceil(reviewPopulation * anomalyThreshold)
          ? { severity: 'medium', code: 'mel-cdl-deferral-spike', metric: melCdlDeferralCount }
          : null,
      ].filter((alert): alert is { severity: string; code: string; metric: number } => Boolean(alert));
      return res.status(200).json({
        version: 'v2',
        interface: 'detect-compliance-anomalies',
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
          detection_window: detectionWindow,
          review_population: reviewPopulation,
          anomaly_threshold: anomalyThreshold,
        },
        output: {
          alert_count: alerts.length,
          alerts,
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'load-regulator-profile-pack') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const body = parseBody(req.body);
      const regulatorProfile = assertNonEmpty(body.regulator_profile, 'regulator_profile').toLowerCase();
      if (!ALLOWED_REGULATOR_PROFILES.has(regulatorProfile)) {
        throw new Error('regulator_profile is not supported');
      }
      const effectiveAt = parseIsoTimestamp(body.effective_at || new Date().toISOString(), 'effective_at');
      const profilePack = buildRegulatorProfilePack(regulatorProfile as 'faa' | 'easa' | 'caac');
      return res.status(200).json({
        version: 'v2',
        interface: 'load-regulator-profile-pack',
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
          regulator_profile: regulatorProfile,
          effective_at: effectiveAt,
        },
        output: {
          profile_pack_id: `${tenantId}-${regulatorProfile}-profile-pack-${Date.now()}`,
          profile_pack: profilePack,
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'evaluate-closure-quality-gate') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const body = parseBody(req.body);
      const workPackageId = assertNonEmpty(body.work_package_id, 'work_package_id');
      const openFindings = parseInteger(body.open_findings, 'open_findings');
      const unresolvedDeferrals = parseInteger(body.unresolved_deferrals, 'unresolved_deferrals');
      const pendingSignatures = parseInteger(body.pending_signatures, 'pending_signatures');
      const evidenceCoveragePct = Number(body.evidence_coverage_pct);
      if (!Number.isFinite(evidenceCoveragePct) || evidenceCoveragePct < 0 || evidenceCoveragePct > 100) {
        throw new Error('evidence_coverage_pct must be between 0 and 100');
      }
      const closureDecision =
        openFindings === 0
        && unresolvedDeferrals === 0
        && pendingSignatures === 0
        && evidenceCoveragePct >= 95
          ? 'pass'
          : 'fail';
      const blockers = [
        openFindings > 0 ? { gate: 'open_findings', reason: `${openFindings} findings remain open` } : null,
        unresolvedDeferrals > 0 ? { gate: 'unresolved_deferrals', reason: `${unresolvedDeferrals} deferrals unresolved` } : null,
        pendingSignatures > 0 ? { gate: 'pending_signatures', reason: `${pendingSignatures} signatures pending` } : null,
        evidenceCoveragePct < 95 ? { gate: 'evidence_coverage', reason: 'evidence coverage below 95%' } : null,
      ].filter(Boolean);
      const auditRecord = cutoverState.enabled
        ? appendComplianceMutationAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          interfaceName,
          entityId: workPackageId,
          context: {
            gate: 'pre-closure',
            openFindings,
            unresolvedDeferrals,
            pendingSignatures,
            evidenceCoveragePct,
            decision: closureDecision,
          },
          actorId: ctx.userId,
          actorRole: ctx.role,
        })
        : null;
      return res.status(200).json({
        version: 'v2',
        interface: 'evaluate-closure-quality-gate',
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
          open_findings: openFindings,
          unresolved_deferrals: unresolvedDeferrals,
          pending_signatures: pendingSignatures,
          evidence_coverage_pct: evidenceCoveragePct,
        },
        output: {
          decision: closureDecision,
          blockers,
          release_ready: closureDecision === 'pass',
        },
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
      });
    }

    if (req.method === 'POST' && interfaceName === 'post-release-audit-gate') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const body = parseBody(req.body);
      const workPackageId = assertNonEmpty(body.work_package_id, 'work_package_id');
      const releaseDecisionId = assertNonEmpty(body.release_decision_id, 'release_decision_id');
      const evidenceLinkHash = assertNonEmpty(body.evidence_link_hash, 'evidence_link_hash');
      const records = replayAmroAuditLedgerRecords({
        tenantId,
        franchiseId,
        limit: 200,
      });
      const releaseRecord = records.find((record) =>
        record.capability === 'certification' && String(record.entityId) === workPackageId
      );
      const replayReady = records.length > 0
        && records.every((record, index) => index === 0 || record.previousHash === records[index - 1]?.chainHash);
      const decision = releaseRecord && replayReady ? 'pass' : 'fail';
      const blockers = [
        releaseRecord ? '' : 'release decision audit entry missing',
        replayReady ? '' : 'replay chain verification failed',
      ].filter((value) => Boolean(value));
      const auditRecord = cutoverState.enabled
        ? appendComplianceMutationAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          interfaceName,
          entityId: workPackageId,
          context: {
            gate: 'post-release',
            releaseDecisionId,
            evidenceLinkHash,
            replayReady,
            decision,
          },
          actorId: ctx.userId,
          actorRole: ctx.role,
        })
        : null;
      return res.status(200).json({
        version: 'v2',
        interface: 'post-release-audit-gate',
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
          release_decision_id: releaseDecisionId,
          evidence_link_hash: evidenceLinkHash,
        },
        output: {
          decision,
          blockers,
          immutable_audit_entry: Boolean(releaseRecord),
          replay_readiness_verified: replayReady,
        },
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
      });
    }

    if (req.method === 'POST' && interfaceName === 'register-exception-request') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const role = String(ctx.role || '').trim().toLowerCase();
      if (!ALLOWED_EXCEPTION_REQUEST_ROLES.has(role)) {
        throw new Error('only allowed roles may request exception');
      }
      const body = parseBody(req.body);
      assertScopeRequired(tenantId, franchiseId);
      assertOptionalScopeContext(body, tenantId, franchiseId);
      const workPackageId = assertNonEmpty(body.work_package_id, 'work_package_id');
      assertOptionalScopedIdentifier(workPackageId, tenantId, 'work_package_id');
      const obligationId = assertNonEmpty(body.obligation_id, 'obligation_id');
      assertOptionalScopedIdentifier(obligationId, tenantId, 'obligation_id');
      const justification = assertNonEmpty(body.justification, 'justification');
      const requestedBy = assertNonEmpty(body.requested_by, 'requested_by');
      const slaDueAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const output = {
        exception_id: `${tenantId}-${workPackageId}-exception-${Date.now()}`,
        review_status: 'pending_review',
        sla_due_at: slaDueAt,
      };
      const auditRecord = cutoverState.enabled
        ? appendComplianceMutationAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          interfaceName,
          entityId: output.exception_id,
          context: {
            workPackageId,
            obligationId,
            requestedBy,
          },
          actorId: ctx.userId,
          actorRole: ctx.role,
        })
        : null;
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
        output,
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
      });
    }

    if (req.method === 'POST' && interfaceName === 'generate-compliance-dossier') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const body = parseBody(req.body);
      assertScopeRequired(tenantId, franchiseId);
      assertOptionalScopeContext(body, tenantId, franchiseId);
      const workPackageId = assertNonEmpty(body.work_package_id, 'work_package_id');
      assertOptionalScopedIdentifier(workPackageId, tenantId, 'work_package_id');
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
      const output = {
        dossier_id: `${tenantId}-${workPackageId}-dossier-${Date.now()}`,
        dossier_status: 'finalized',
        artifact_manifest: includeArtifacts.map((artifact) => ({
          artifact,
          collected_at: parseIsoTimestamp(new Date().toISOString(), 'collected_at'),
        })),
      };
      const auditRecord = cutoverState.enabled
        ? appendComplianceMutationAuditRecord({
          tenantId,
          franchiseId,
          correlationId: ctx.correlationId,
          compatMode: compatDecision.compatMode,
          interfaceName,
          entityId: output.dossier_id,
          context: {
            workPackageId,
            profile,
            artifactCount: includeArtifacts.length,
          },
          actorId: ctx.userId,
          actorRole: ctx.role,
        })
        : null;
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
        output,
        auditLedgerCutover: cutoverState,
        auditLedger: auditRecord ? {
          eventType: auditRecord.eventType,
          recordId: auditRecord.recordId,
          chainHash: auditRecord.chainHash,
          replayCheckpoint: auditRecord.replayCheckpoint,
        } : null,
      });
    }

    if (req.method === 'POST') {
      return res.status(400).json({
        error: 'Unsupported interface. Use evaluate-compliance-gate, pre-schedule-compliance-gate, pre-execution-compliance-gate, ingest-ad-sb-obligations, evaluate-mel-cdl-deferral, load-compliance-gate-explainability, load-audit-replay-timeline, detect-compliance-anomalies, load-regulator-profile-pack, evaluate-closure-quality-gate, post-release-audit-gate, register-exception-request, or generate-compliance-dossier.',
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
