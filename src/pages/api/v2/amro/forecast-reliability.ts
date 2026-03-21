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
import { enforceAmroSequentialMilestoneForForecastReliabilityInterface } from './phase-plan-model';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isV2Enabled(): boolean {
  return parseBoolean(process.env.AMRO_FORECAST_RELIABILITY_V2_ENABLED, false);
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

function parseNumber(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a number`);
  }
  return parsed;
}

function parseTimestamp(value: unknown, fieldName: string): string {
  const normalized = assertNonEmpty(value, fieldName);
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid ISO timestamp`);
  }
  return new Date(parsed).toISOString();
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
  return value.map((entry) => String(entry || '').trim()).filter(Boolean);
}

function computeRiskScore(defectCount: number, severeEnvironment: boolean, missingFeatureCount: number): number {
  const base = defectCount * 12 + (severeEnvironment ? 20 : 8) + missingFeatureCount * 3;
  return Math.max(0, Math.min(100, Number(base.toFixed(2))));
}

function buildInterventions(riskScore: number): string[] {
  if (riskScore >= 80) return ['grounding-inspection', 'priority-component-replacement', 'daily-monitoring'];
  if (riskScore >= 60) return ['targeted-diagnostic-check', 'enhanced-inspection-window'];
  if (riskScore >= 35) return ['condition-monitoring', 'next-check-bundle'];
  return ['routine-monitoring'];
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
        error: 'AMRO forecast-reliability v2 endpoint is disabled',
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
      capability: 'forecast-reliability',
      scope: isolationScope,
      subscriptionStatus: amroAccess.subscriptionStatus,
      validatedAt: amroAccess.validatedAt,
    });
    const rolloutState = resolveAmroV2EndpointRolloutState({
      tenantId,
      franchiseId,
      capability: 'forecast-reliability',
    });
    if (!rolloutState.enabled) {
      return res.status(404).json({
        error: 'AMRO forecast-reliability v2 endpoint is not enabled for this rollout cohort',
        endpointRollout: rolloutState,
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }
    const cutoverState = resolveAmroAuditLedgerCutoverState({
      tenantId,
      franchiseId,
      capability: 'forecast-reliability',
    });

    enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
    const interfaceName = String(req.query.interface || '').trim().toLowerCase();
    enforceAmroSequentialMilestoneForForecastReliabilityInterface(interfaceName);
    const body = parseBody(req.body);

    if (interfaceName === 'score-maintenance-risk') {
      const assetId = assertNonEmpty(body.asset_id, 'asset_id');
      const telemetryFeatures = parseObjectArray(body.telemetry_features, 'telemetry_features');
      const defectHistory = parseObjectArray(body.defect_history, 'defect_history');
      const environment = parseBody(body.environment_context);
      const requiredFeatures = parseNumber(body.required_feature_count || 5, 'required_feature_count');
      const completenessThreshold = parseNumber(body.feature_completeness_threshold || 0.6, 'feature_completeness_threshold');
      if (completenessThreshold <= 0 || completenessThreshold > 1) {
        throw new Error('Feature completeness threshold required');
      }
      const completeness = telemetryFeatures.length / requiredFeatures;
      const confidenceScore = Math.max(0, Math.min(1, Number(completeness.toFixed(2))));
      const severeEnvironment = String(environment.severity || '').trim().toLowerCase() === 'severe';
      const missingFeatureCount = Math.max(0, requiredFeatures - telemetryFeatures.length);
      const riskScore = computeRiskScore(defectHistory.length, severeEnvironment, missingFeatureCount);
      const topFactors = [
        defectHistory.length > 0 ? 'defect_history_density' : 'stable_defect_history',
        severeEnvironment ? 'severe_environment_context' : 'normal_environment_context',
        confidenceScore < completenessThreshold ? 'low_feature_completeness_flagged' : 'feature_completeness_satisfied',
      ];
      const auditRecord = cutoverState.enabled
        ? appendAmroAuditLedgerRecord({
          tenantId,
          franchiseId,
          capability: 'forecast-reliability',
          eventType: 'amro.forecast.risk.scored.v1',
          entityType: 'forecast-assessment',
          entityId: assetId,
          correlationId: ctx.correlationId,
          action: interfaceName,
          compatMode: compatDecision.compatMode,
          context: { telemetryCount: telemetryFeatures.length, defectCount: defectHistory.length, confidenceScore },
          sourceHash: `${tenantId}:${assetId}:${riskScore}:${confidenceScore}`,
          migrationBatchId: `migration-${tenantId}-${Date.now()}`,
          replayCheckpoint: `forecast-${Date.now()}`,
        })
        : null;
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          risk_score: riskScore,
          confidence_score: confidenceScore,
          top_factors: topFactors,
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

    if (interfaceName === 'generate-intervention-recommendations') {
      const riskScore = parseNumber(body.risk_score, 'risk_score');
      const policyRules = parseBody(body.policy_rules);
      const resourceConstraints = parseBody(body.resource_constraints);
      const complianceBlockedActions = parseStringArray(policyRules.compliance_blocked_actions || [], 'policy_rules.compliance_blocked_actions');
      const availableCapacity = parseNumber(resourceConstraints.available_capacity || 0, 'resource_constraints.available_capacity');
      const candidates = buildInterventions(riskScore);
      const compliant = candidates.filter((item) => !complianceBlockedActions.includes(item));
      const interventions = availableCapacity > 0 ? compliant.slice(0, Math.max(1, Math.floor(availableCapacity))) : [];
      if (!interventions.length) {
        throw new Error('Recommendations must respect compliance and capacity constraints');
      }
      const expectedImpact = Number((Math.min(0.45, riskScore / 250) * interventions.length).toFixed(2));
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          interventions,
          expected_impact: expectedImpact,
          rationale: `Selected ${interventions.length} intervention(s) after compliance and capacity filtering`,
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

    if (interfaceName === 'capture-recommendation-outcome') {
      const recommendationId = assertNonEmpty(body.recommendation_id, 'recommendation_id');
      const operatorAction = assertNonEmpty(body.operator_action, 'operator_action');
      const outcomeMetrics = parseObjectArray(body.outcome_metrics, 'outcome_metrics');
      const feedbackPolicy = parseBody(body.feedback_policy);
      const windowStart = parseTimestamp(feedbackPolicy.window_start, 'feedback_policy.window_start');
      const windowEnd = parseTimestamp(feedbackPolicy.window_end, 'feedback_policy.window_end');
      const allowedMetricKeys = parseStringArray(feedbackPolicy.allowed_metric_keys, 'feedback_policy.allowed_metric_keys');
      const outcomeAt = parseTimestamp(body.outcome_at, 'outcome_at');
      const outcomeMs = Date.parse(outcomeAt);
      if (outcomeMs < Date.parse(windowStart) || outcomeMs > Date.parse(windowEnd)) {
        throw new Error('Outcome window and metric schema must match configured feedback policy');
      }
      const schemaMismatch = outcomeMetrics.some((metric) => {
        const key = String(metric.key || '').trim();
        const value = Number(metric.value);
        return !allowedMetricKeys.includes(key) || !Number.isFinite(value);
      });
      if (schemaMismatch) {
        throw new Error('Outcome window and metric schema must match configured feedback policy');
      }
      return res.status(200).json({
        version: 'v2',
        interface: interfaceName,
        correlationId: ctx.correlationId,
        output: {
          feedback_id: `${tenantId}-${recommendationId}-feedback-${Date.now()}`,
          learning_status: 'queued_for_learning',
          model_update_hint: operatorAction === 'accepted' ? 'reinforce_policy_weights' : 'review_false_positive_bias',
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
      error: 'Unsupported interface. Use score-maintenance-risk, generate-intervention-recommendations, or capture-recommendation-outcome.',
      correlationId: ctx.correlationId,
      version: 'v2',
    });
  } catch (error: any) {
    return sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
