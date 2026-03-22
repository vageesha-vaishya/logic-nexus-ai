import { createHash } from 'node:crypto';
import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
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
} from '../../../../_utils/http';
import { sendErrorResponse } from '../../../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../../_utils/compatibility-facade';

type ApiAmroComplianceErrorCode = 'AMRO_POLICY_NOT_FOUND' | 'AMRO_EVALUATION_CONTEXT_INVALID' | 'AMRO_IDEMPOTENCY_KEY_REQUIRED' | 'AMRO_AUTH_SCOPE_INVALID';

const POLICY_VERSIONS: Record<string, string> = {
  faa: 'faa-policy-v2.4',
  easa: 'easa-policy-v3.1',
  caac: 'caac-policy-v1.9',
};

function parseBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') {
    return body as Record<string, unknown>;
  }
  return {};
}

function parseHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
}

function parseNonEmpty(value: unknown, fieldName: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`invalid:${fieldName}`);
  }
  return normalized;
}

function resolveIdempotencyKey(req: ApiRequest): string {
  const key = parseHeaderValue(req.headers['idempotency-key'] || req.headers['Idempotency-Key']);
  if (!key || key.length < 8) {
    throw new Error('idempotency');
  }
  return key;
}

function resolveScopedRole(role: string): string {
  const normalized = String(role || '').trim().toLowerCase();
  if (['platform_admin', 'admin', 'tenant_admin', 'franchise_manager', 'planner', 'engineer', 'technician', 'inspector'].includes(normalized)) {
    return normalized;
  }
  throw new Error('auth_scope');
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  const normalized = String(value || '').trim();
  if (!normalized) return [];
  return normalized.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function sendApiError(
  res: ApiResponse,
  traceId: string,
  status: number,
  code: ApiAmroComplianceErrorCode,
  message: string,
  details: string[],
  retryable: boolean,
) {
  res.status(status).json({
    version: 'v2',
    code,
    message,
    details,
    trace_id: traceId,
    retryable,
  });
}

function mapError(error: unknown, traceId: string, res: ApiResponse): boolean {
  const message = error instanceof Error ? error.message : '';
  if (message === 'idempotency') {
    sendApiError(
      res,
      traceId,
      422,
      'AMRO_IDEMPOTENCY_KEY_REQUIRED',
      'Idempotency-Key header is required for mutating endpoints',
      ['Provide an Idempotency-Key header with at least 8 characters.'],
      false,
    );
    return true;
  }
  if (message === 'auth_scope' || message === 'Forbidden') {
    sendApiError(
      res,
      traceId,
      403,
      'AMRO_AUTH_SCOPE_INVALID',
      'Actor scope is invalid for compliance evaluation',
      ['Verify role and contextual ABAC claims before retrying.'],
      false,
    );
    return true;
  }
  if (message.startsWith('invalid:')) {
    sendApiError(
      res,
      traceId,
      422,
      'AMRO_EVALUATION_CONTEXT_INVALID',
      'Evaluation context is invalid',
      [message.replace('invalid:', '')],
      false,
    );
    return true;
  }
  if (message === 'policy_not_found') {
    sendApiError(
      res,
      traceId,
      404,
      'AMRO_POLICY_NOT_FOUND',
      'Compliance policy is not available for requested regulator profile',
      ['Use regulator profile FAA, EASA, or CAAC.'],
      false,
    );
    return true;
  }
  return false;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const compatibility = resolveGatewayCompatibility(req, { tenantId: ctx.tenantId, franchiseId: ctx.franchiseId });
  applyCompatibilityResponseHeaders(res, compatibility, ctx.correlationId);

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed`, correlationId: ctx.correlationId, version: 'v2' });
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    resolveScopedRole(auth.role);
    enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
    const access = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });
    const idempotencyKey = resolveIdempotencyKey(req);

    const body = parseBody(req.body);
    const entityType = parseNonEmpty(body.entity_type, 'entity_type').toLowerCase();
    if (entityType !== 'work_package' && entityType !== 'task') {
      throw new Error('invalid:entity_type');
    }
    const entityId = parseNonEmpty(body.entity_id, 'entity_id');
    const regulatorProfile = parseNonEmpty(body.regulator_profile, 'regulator_profile').toLowerCase();
    const policyVersion = POLICY_VERSIONS[regulatorProfile];
    if (!policyVersion) {
      throw new Error('policy_not_found');
    }
    const evaluationContext = parseBody(body.evaluation_context);
    const station = parseNonEmpty(evaluationContext.station, 'evaluation_context.station');
    const aircraftScope = parseStringArray(evaluationContext.aircraft_scope);
    const qualification = parseNonEmpty(evaluationContext.qualification, 'evaluation_context.qualification');
    if (aircraftScope.length === 0) {
      throw new Error('invalid:evaluation_context.aircraft_scope');
    }
    if (station.includes(':') && !station.startsWith(`${access.tenantId}:`)) {
      throw new Error('auth_scope');
    }
    const obligationBlockers = parseStringArray(evaluationContext.blockers);
    const warnings = parseStringArray(evaluationContext.warnings);
    const decision = obligationBlockers.length > 0 ? 'fail' : warnings.length > 0 ? 'conditional_pass' : 'pass';
    const decisionTraceId = createHash('sha256').update(
      JSON.stringify({
        tenant_id: access.tenantId,
        entity_type: entityType,
        entity_id: entityId,
        regulator_profile: regulatorProfile,
        idempotency_key: idempotencyKey,
      }),
    ).digest('hex').slice(0, 32);

    return res.status(200).json({
      version: 'v2',
      decision,
      blockers: obligationBlockers,
      warnings,
      policy_version: policyVersion,
      decision_trace_id: decisionTraceId,
      applied_context: {
        entity_type: entityType,
        entity_id: entityId,
        regulator_profile: regulatorProfile.toUpperCase(),
        station,
        aircraft_scope: aircraftScope,
        qualification,
      },
      api_guardrails: {
        class: 'transition/gate',
        p95_target_ms: 500,
        p99_target_ms: 900,
        availability_target: 99.95,
      },
      trace_id: ctx.correlationId,
    });
  } catch (error) {
    if (mapError(error, ctx.correlationId, res)) {
      return;
    }
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
