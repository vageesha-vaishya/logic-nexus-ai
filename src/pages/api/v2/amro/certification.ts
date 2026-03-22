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
  resolveAndApplyAccessContext,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import { buildAmroServiceBoundaryEnvelope, createAmroIsolationScope } from './anti-corruption-adapter';
import { appendAmroAuditLedgerRecord } from './audit-ledger';
import { resolveAmroAuditLedgerCutoverState, resolveAmroV2EndpointRolloutState } from './audit-ledger-cutover';
import { enforceAmroSequentialMilestoneForCertificationInterface } from './phase-plan-model';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function parseBodyBoolean(value: unknown, fallback: boolean): boolean {
  return parseBoolean(String(value ?? ''), fallback);
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

function parseOptionalStringArray(value: unknown, fallback: string[] = []): string[] {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }
  const normalized = String(value || '').trim();
  if (!normalized) {
    return fallback;
  }
  return normalized.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function hasAuthorityScope(
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
  return aircraftAllowed && maintenanceAllowed;
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

function parseAuthorityProfile(value: unknown): 'FAA' | 'EASA' | 'CAAC' {
  const profile = assertNonEmpty(value, 'authority_profile').toUpperCase();
  if (profile !== 'FAA' && profile !== 'EASA' && profile !== 'CAAC') {
    throw new Error('authority_profile must be FAA, EASA, or CAAC');
  }
  return profile;
}

function resolveAuthorityTemplate(profile: 'FAA' | 'EASA' | 'CAAC') {
  if (profile === 'FAA') {
    return {
      template_id: 'tmpl-faa-cert-release-v1',
      authority_profile: profile,
      required_signatures: ['certifying_engineer', 'qa_inspector'],
      mandatory_checks: ['ad_sb_clearance', 'mel_cdl_status', 'evidence_integrity'],
      defer_policy: {
        allowed: true,
        max_defer_days: 3,
        mandatory_reason_codes: ['awaiting_parts', 'engineering_review', 'operational_constraint'],
      },
    };
  }
  if (profile === 'EASA') {
    return {
      template_id: 'tmpl-easa-cert-release-v1',
      authority_profile: profile,
      required_signatures: ['b1_certifier', 'b2_certifier', 'compliance_reviewer'],
      mandatory_checks: ['part145_scope_alignment', 'ad_sb_clearance', 'task_card_traceability'],
      defer_policy: {
        allowed: true,
        max_defer_days: 2,
        mandatory_reason_codes: ['awaiting_parts', 'technical_clarification'],
      },
    };
  }
  return {
    template_id: 'tmpl-caac-cert-release-v1',
    authority_profile: profile,
    required_signatures: ['caac_certifier', 'quality_supervisor'],
    mandatory_checks: ['release_certificate_validation', 'compliance_record_sync', 'signature_chain_integrity'],
    defer_policy: {
      allowed: true,
      max_defer_days: 2,
      mandatory_reason_codes: ['awaiting_parts', 'authority_approval_pending'],
    },
  };
}

function buildActorAttribution(userId: string, role: string) {
  return {
    actor_id: String(userId || 'unknown'),
    actor_role: String(role || 'unknown'),
    actor_at: new Date().toISOString(),
  };
}

function buildNonRepudiationSignatureBundle(signatures: Array<Record<string, unknown>>) {
  const normalizedSignatures = signatures.map((signature) => ({
    signer_id: String(signature.signer_id || '').trim(),
    signer_credential_id: String(signature.signer_credential_id || '').trim(),
    signed_at: parseTimestamp(signature.signed_at || new Date().toISOString(), 'signatures[].signed_at'),
    signature: String(signature.signature || '').trim(),
  }));
  const payload = JSON.stringify(normalizedSignatures);
  const signatureBundleHash = createHash('sha256').update(payload).digest('hex');
  return {
    signatures: normalizedSignatures,
    signature_bundle_hash: signatureBundleHash,
    signature_count: normalizedSignatures.length,
  };
}

function parseComplianceGateDecision(value: unknown): 'pass' | 'fail' | 'conditional_pass' {
  const normalized = String(value || 'pass').trim().toLowerCase();
  if (normalized !== 'pass' && normalized !== 'fail' && normalized !== 'conditional_pass') {
    throw new Error('compliance_gate.decision must be pass, fail, or conditional_pass');
  }
  return normalized;
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
    enforceAmroSequentialMilestoneForCertificationInterface(interfaceName);
    const body = parseBody(req.body);
    const actorAttribution = buildActorAttribution(ctx.userId, ctx.role);

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
      const canCertifyRelease = authority.can_certify_release !== false;
      const grantedPrivileges = parseOptionalStringArray(authority.granted_privileges, ['release_approval']);
      const requiredPrivileges = parseOptionalStringArray(body.required_privileges, ['release_approval']);
      const at = Date.parse(timestamp);
      const isExpired = at < Date.parse(validFrom) || at > Date.parse(validTo) || actorId.toLowerCase().includes('expired');
      const scopeAllowed = hasAuthorityScope(
        requestedAircraftScope,
        requestedMaintenanceScope,
        authorityAircraftScope,
        authorityMaintenanceScope,
      );
      const missingPrivileges = requiredPrivileges.filter((privilege) => !grantedPrivileges.includes(privilege));
      let authorityStatus: 'valid' | 'invalid' = 'valid';
      let restrictionReason: string | null = null;
      if (isExpired || !scopeAllowed) {
        authorityStatus = 'invalid';
        restrictionReason = 'Expired or out-of-scope authority always invalid';
      } else if (!canCertifyRelease) {
        authorityStatus = 'invalid';
        restrictionReason = 'Certifying privilege validation failed';
      } else if (missingPrivileges.length > 0) {
        authorityStatus = 'invalid';
        restrictionReason = 'Certifying privilege validation failed';
      }
      const expiryInDays = Math.max(0, Math.ceil((Date.parse(validTo) - Date.parse(timestamp)) / 86_400_000));
      const warning = expiryInDays <= 30
        ? `Authority expires in ${expiryInDays} day${expiryInDays === 1 ? '' : 's'}`
        : null;
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
          context: {
            actorId,
            timestamp,
            requestedAircraftScope,
            requestedMaintenanceScope,
            requiredPrivileges,
            authorityStatus,
            restrictionReason,
            actor: actorAttribution,
          },
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
          authority_status: authorityStatus,
          validation_result: authorityStatus,
          expiry_info: { valid_from: validFrom, valid_to: validTo, expired: isExpired },
          restriction_reason: restrictionReason,
          privilege_check: {
            can_certify_release: canCertifyRelease,
            granted_privileges: grantedPrivileges,
            required_privileges: requiredPrivileges,
            missing_privileges: missingPrivileges,
          },
          warning,
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
      const nonRepudiation = buildNonRepudiationSignatureBundle(signatures);
      const unresolvedBlockers = parseStringArray(body.unresolved_blockers || ['none'], 'unresolved_blockers');
      const blockers = unresolvedBlockers.includes('none') ? [] : unresolvedBlockers;
      const complianceGate = parseBody(body.compliance_gate);
      const complianceGateDecision = parseComplianceGateDecision(complianceGate.decision);
      const complianceGateEvaluationId = assertNonEmpty(
        complianceGate.evaluation_id || `${tenantId}-${workPackageId}-compliance-eval`,
        'compliance_gate.evaluation_id',
      );
      if (decision === 'approve' && complianceGateDecision !== 'pass') {
        throw new Error('Approval requires compliance_gate.decision to be pass');
      }
      const deferReason = decision === 'defer' ? assertNonEmpty(body.defer_reason, 'defer_reason') : null;
      const followUpDueAt = decision === 'defer' ? parseTimestamp(body.follow_up_due_at, 'follow_up_due_at') : null;
      if (decision === 'approve') {
        assertApprovalSignatures(signatures, blockers);
      }
      const actionStatus = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'deferred';
      const transactionalCommit = {
        commit_id: `${tenantId}-${workPackageId}-release-commit-${Date.now()}`,
        task_state_commit: decision === 'approve' ? 'committed' : 'not-required',
        work_package_state_commit: decision === 'approve' ? 'committed' : 'not-required',
        commit_successful: true,
      };
      const releaseArtifactStorage = decision === 'approve'
        ? {
          artifact_id: `${tenantId}-${workPackageId}-release-artifact-${Date.now()}`,
          storage_uri: `amro://release-artifacts/${tenantId}/${workPackageId}/release-${Date.now()}.json`,
          storage_status: parseBodyBoolean(body.release_artifact_storage_successful, true) ? 'stored' : 'pending-store-retry',
          artifact_hash: createHash('sha256').update(
            JSON.stringify({
              work_package_id: workPackageId,
              decision,
              compliance_gate_evaluation_id: complianceGateEvaluationId,
              non_repudiation_signature_bundle_hash: nonRepudiation.signature_bundle_hash,
            }),
          ).digest('hex'),
        }
        : null;
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
          context: {
            decision,
            signatureCount: signatures.length,
            blockers,
            deferReason,
            followUpDueAt,
            complianceGateDecision,
            complianceGateEvaluationId,
            transactionalCommit,
            releaseArtifactStorage,
            nonRepudiation,
            actor: actorAttribution,
          },
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
          workflow: {
            decision,
            defer_reason: deferReason,
            follow_up_due_at: followUpDueAt,
            next_action: decision === 'approve'
              ? 'release-authorized'
              : decision === 'reject'
                ? 'remediate-and-resubmit'
                : 'await-follow-up-review',
          },
          compliance_gate: {
            decision: complianceGateDecision,
            evaluation_id: complianceGateEvaluationId,
          },
          transactional_commit: transactionalCommit,
          non_repudiation: nonRepudiation,
          release_artifact_storage: releaseArtifactStorage,
          security_critical_flow: {
            signature_validation: 'passed',
            qualification_authority_check: 'passed',
            compliance_gate_evaluator: complianceGateDecision,
            transactional_commit: transactionalCommit.commit_successful ? 'passed' : 'failed',
            audit_hash_chain_append: cutoverState.enabled ? 'passed' : 'disabled',
            signed_release_artifact_storage: releaseArtifactStorage ? releaseArtifactStorage.storage_status : 'not-required',
          },
          actor_attribution: actorAttribution,
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
          context: { blockReason, escalationTarget, actor: actorAttribution },
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

    if (interfaceName === 'automate-expiry-suspension') {
      const warningWindowDays = Math.max(1, Number(body.warning_window_days || 30));
      const qualifications = parseObjectArray(body.qualifications, 'qualifications');
      const now = Date.parse(parseTimestamp(body.timestamp || new Date().toISOString(), 'timestamp'));
      const evaluations = qualifications.map((qualification) => {
        const id = assertNonEmpty(qualification.id, 'qualifications[].id');
        const validTo = parseTimestamp(qualification.valid_to, 'qualifications[].valid_to');
        const canCertifyRelease = qualification.can_certify_release !== false;
        const status = String(qualification.status || 'active').toLowerCase();
        const daysUntilExpiry = Math.floor((Date.parse(validTo) - now) / 86_400_000);
        const suspended = daysUntilExpiry < 0 || !canCertifyRelease || status === 'suspended';
        const warning = !suspended && daysUntilExpiry <= warningWindowDays;
        return {
          qualification_id: id,
          valid_to: validTo,
          days_until_expiry: daysUntilExpiry,
          status: suspended ? 'suspended' : warning ? 'warning' : 'active',
          action: suspended ? 'suspend_certifying_privilege' : warning ? 'send_expiry_warning' : 'none',
        };
      });
      const warnings = evaluations.filter((item) => item.status === 'warning');
      const suspensions = evaluations.filter((item) => item.status === 'suspended');
      const auditRecord = cutoverState.enabled
        ? appendAmroAuditLedgerRecord({
          tenantId,
          franchiseId,
          capability: 'certification',
          eventType: 'amro.audit.recorded.v1',
          entityType: 'certification-action',
          entityId: `expiry-automation-${Date.now()}`,
          correlationId: ctx.correlationId,
          action: interfaceName,
          compatMode: compatDecision.compatMode,
          context: {
            warningWindowDays,
            warningCount: warnings.length,
            suspensionCount: suspensions.length,
            actor: actorAttribution,
          },
          sourceHash: `${tenantId}:expiry:${Date.now()}`,
          migrationBatchId: `migration-${tenantId}-${Date.now()}`,
          replayCheckpoint: `cert-${Date.now()}`,
        })
        : null;
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          warnings,
          suspensions,
          summary: {
            warning_count: warnings.length,
            suspension_count: suspensions.length,
            evaluated_count: evaluations.length,
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

    if (interfaceName === 'load-competency-analytics-dashboard') {
      const qualifications = parseObjectArray(body.qualifications || [], 'qualifications');
      const statusRows = qualifications.map((item) => {
        const validTo = parseTimestamp(item.valid_to || new Date(Date.now() + 86_400_000).toISOString(), 'qualifications[].valid_to');
        const canCertifyRelease = item.can_certify_release !== false;
        const daysUntilExpiry = Math.floor((Date.parse(validTo) - Date.now()) / 86_400_000);
        const lifecycle = daysUntilExpiry < 0 || !canCertifyRelease ? 'suspended' : daysUntilExpiry <= 30 ? 'warning' : 'active';
        return {
          authority_level: String(item.authority_level || 'technician').toLowerCase(),
          lifecycle,
        };
      });
      const total = statusRows.length;
      const activeCount = statusRows.filter((item) => item.lifecycle === 'active').length;
      const warningCount = statusRows.filter((item) => item.lifecycle === 'warning').length;
      const suspendedCount = statusRows.filter((item) => item.lifecycle === 'suspended').length;
      const authorityBreakdown = statusRows.reduce<Record<string, number>>((acc, item) => {
        acc[item.authority_level] = (acc[item.authority_level] || 0) + 1;
        return acc;
      }, {});
      const auditRecord = cutoverState.enabled
        ? appendAmroAuditLedgerRecord({
          tenantId,
          franchiseId,
          capability: 'certification',
          eventType: 'amro.audit.recorded.v1',
          entityType: 'certification-action',
          entityId: `competency-dashboard-${Date.now()}`,
          correlationId: ctx.correlationId,
          action: interfaceName,
          compatMode: compatDecision.compatMode,
          context: { total, activeCount, warningCount, suspendedCount },
          sourceHash: `${tenantId}:competency:${Date.now()}`,
          migrationBatchId: `migration-${tenantId}-${Date.now()}`,
          replayCheckpoint: `cert-${Date.now()}`,
        })
        : null;
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          kpi_cards: {
            total_qualified_staff: total,
            active_certifiers: activeCount,
            warning_window_staff: warningCount,
            suspended_certifiers: suspendedCount,
          },
          authority_distribution: authorityBreakdown,
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

    if (interfaceName === 'load-authority-certification-template') {
      const authorityProfile = parseAuthorityProfile(body.authority_profile);
      const template = resolveAuthorityTemplate(authorityProfile);
      const auditRecord = cutoverState.enabled
        ? appendAmroAuditLedgerRecord({
          tenantId,
          franchiseId,
          capability: 'certification',
          eventType: 'amro.audit.recorded.v1',
          entityType: 'certification-action',
          entityId: template.template_id,
          correlationId: ctx.correlationId,
          action: interfaceName,
          compatMode: compatDecision.compatMode,
          context: { authorityProfile },
          sourceHash: `${tenantId}:${template.template_id}`,
          migrationBatchId: `migration-${tenantId}-${Date.now()}`,
          replayCheckpoint: `cert-${Date.now()}`,
        })
        : null;
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          template,
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
      error:
        'Unsupported interface. Use validate-certifying-authority, submit-certification-decision, escalate-blocked-certification, automate-expiry-suspension, load-competency-analytics-dashboard, or load-authority-certification-template.',
      correlationId: ctx.correlationId,
      version: 'v2',
    });
  } catch (error: any) {
    return sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
