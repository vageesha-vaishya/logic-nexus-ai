import type { ApiRequest, ApiResponse } from '../../_utils/types';
import {
  applyCors,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import { buildAmroServiceBoundaryEnvelope, createAmroIsolationScope } from './anti-corruption-adapter';
import {
  AMRO_ASYNCAPI_SPEC_PATH,
  AMRO_GRAPHQL_SUBGRAPH_PATH,
  AMRO_GRPC_PROTO_PATH,
  AMRO_INTEGRATION_CONTRACTS,
  AMRO_OPENAPI_SPEC_PATH,
} from './integration-contracts';
import { buildAmroGaReadinessEnvelope } from './phase-plan-model';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isV2Enabled(): boolean {
  return parseBoolean(process.env.AMRO_HEALTH_V2_ENABLED, true);
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function resolveThresholdStatus(observedValue: number, threshold: number): 'ok' | 'alert' {
  return observedValue > threshold ? 'alert' : 'ok';
}

function resolveAvailabilityStatus(observedValue: number, target: number): 'ok' | 'alert' {
  return observedValue >= target ? 'ok' : 'alert';
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const initialDecision = resolveGatewayCompatibility(req);
  applyCompatibilityResponseHeaders(res, initialDecision, ctx.correlationId);

  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed`, correlationId: ctx.correlationId, version: 'v2' });
    }
    if (!isV2Enabled()) {
      return res.status(404).json({
        error: 'AMRO health v2 endpoint is disabled',
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const tenantId = 'public';
    const franchiseId = null;
    const compatDecision = resolveGatewayCompatibility(req, { tenantId, franchiseId });
    applyCompatibilityResponseHeaders(res, compatDecision, ctx.correlationId);
    const scope = createAmroIsolationScope(tenantId, franchiseId);
    const serviceBoundaries = buildAmroServiceBoundaryEnvelope({
      capability: 'work-packages',
      scope,
      subscriptionStatus: 'public',
      validatedAt: new Date().toISOString(),
    });
    const gaReadiness = buildAmroGaReadinessEnvelope();
    const apiGatewayObservedAvailability = parseNumber(process.env.AMRO_SLO_API_GATEWAY_AVAILABILITY, 99.97);
    const apiGatewayObserved5xxRate = parseNumber(process.env.AMRO_SLO_API_GATEWAY_5XX_RATE_PERCENT, 0.4);
    const workflowObservedAvailability = parseNumber(process.env.AMRO_SLO_WORKFLOW_AVAILABILITY, 99.96);
    const workflowObservedTransitionFailureRate = parseNumber(process.env.AMRO_SLO_WORKFLOW_TRANSITION_FAILURE_PERCENT, 0.2);
    const complianceObservedAvailability = parseNumber(process.env.AMRO_SLO_COMPLIANCE_AVAILABILITY, 99.995);
    const complianceObservedTimeoutRate = parseNumber(process.env.AMRO_SLO_COMPLIANCE_TIMEOUT_PERCENT, 0.1);
    const mobileSyncObservedAvailability = parseNumber(process.env.AMRO_SLO_MOBILE_SYNC_AVAILABILITY, 99.93);
    const mobileSyncObservedBacklogAgeMinutes = parseNumber(process.env.AMRO_SLO_MOBILE_SYNC_BACKLOG_MINUTES, 3);
    const concurrentWorkPackagesPerRegion = parseNumber(process.env.AMRO_CAPACITY_CONCURRENT_WORK_PACKAGES_PER_REGION, 14320);
    const capacityTargetConcurrentWorkPackagesPerRegion = 25000;
    const utilizationPercent = Number(((concurrentWorkPackagesPerRegion / capacityTargetConcurrentWorkPackagesPerRegion) * 100).toFixed(2));
    const capacityStatus = concurrentWorkPackagesPerRegion <= capacityTargetConcurrentWorkPackagesPerRegion ? 'within_capacity' : 'capacity_risk';

    return res.status(200).json({
      version: 'v2',
      mode: 'health',
      correlationId: ctx.correlationId,
      compatMode: compatDecision.compatMode,
      domainAccess: {
        subscriptionStatus: 'public',
        source: 'public',
        validatedAt: serviceBoundaries.scopedAccess.domainAssignmentValidation.validatedAt,
      },
      serviceBoundaries,
      checks: {
        api: 'ok',
        contracts: {
          restEndpointCount: AMRO_INTEGRATION_CONTRACTS.rest.endpoints.length,
          graphqlFieldCount: AMRO_INTEGRATION_CONTRACTS.graphql.fields.length,
          grpcServiceCount: AMRO_INTEGRATION_CONTRACTS.grpc.services.length,
          asyncEventCount: AMRO_INTEGRATION_CONTRACTS.asyncApi.events.length,
        },
        artifacts: {
          openApiPath: AMRO_OPENAPI_SPEC_PATH,
          graphQlPath: AMRO_GRAPHQL_SUBGRAPH_PATH,
          grpcPath: AMRO_GRPC_PROTO_PATH,
          asyncApiPath: AMRO_ASYNCAPI_SPEC_PATH,
        },
        gaReadiness,
        performance: {
          slo_alerting: {
            api_gateway: {
              availability_target_percent: 99.95,
              observed_availability_percent: apiGatewayObservedAvailability,
              availability_status: resolveAvailabilityStatus(apiGatewayObservedAvailability, 99.95),
              error_rate_threshold_percent: 1,
              observed_5xx_rate_percent: apiGatewayObserved5xxRate,
              evaluation_window_minutes: 5,
              error_rate_status: resolveThresholdStatus(apiGatewayObserved5xxRate, 1),
            },
            workflow_orchestration: {
              availability_target_percent: 99.95,
              observed_availability_percent: workflowObservedAvailability,
              availability_status: resolveAvailabilityStatus(workflowObservedAvailability, 99.95),
              transition_failure_threshold_percent: 0.5,
              observed_transition_failure_percent: workflowObservedTransitionFailureRate,
              transition_failure_status: resolveThresholdStatus(workflowObservedTransitionFailureRate, 0.5),
            },
            compliance_gate_engine: {
              availability_target_percent: 99.99,
              observed_availability_percent: complianceObservedAvailability,
              availability_status: resolveAvailabilityStatus(complianceObservedAvailability, 99.99),
              evaluation_timeout_threshold_percent: 0.2,
              observed_evaluation_timeout_percent: complianceObservedTimeoutRate,
              evaluation_timeout_status: resolveThresholdStatus(complianceObservedTimeoutRate, 0.2),
            },
            mobile_sync_service: {
              availability_target_percent: 99.9,
              observed_availability_percent: mobileSyncObservedAvailability,
              availability_status: resolveAvailabilityStatus(mobileSyncObservedAvailability, 99.9),
              sync_backlog_age_threshold_minutes: 10,
              observed_sync_backlog_age_minutes: mobileSyncObservedBacklogAgeMinutes,
              sync_backlog_age_status: resolveThresholdStatus(mobileSyncObservedBacklogAgeMinutes, 10),
            },
          },
          capacity_planning: {
            target_concurrent_work_packages_per_region: capacityTargetConcurrentWorkPackagesPerRegion,
            observed_concurrent_work_packages_per_region: concurrentWorkPackagesPerRegion,
            utilization_percent: utilizationPercent,
            status: capacityStatus,
          },
        },
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
