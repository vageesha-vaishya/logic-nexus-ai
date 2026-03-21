import type { ApiRequest, ApiResponse } from '../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  logApiEvent,
  resolveAndApplyAccessContext,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import { resolveGatewayFeatureFlag } from '../../_utils/gateway-feature-flags';
import {
  evaluateMeshTrafficControl,
  getMeshCoverageSummary,
  getServiceMeshProfile,
  listNamespaceOnboardingStates,
  listServiceMeshProfiles,
  setNamespaceOnboardingState,
  upsertServiceMeshProfile,
  type NamespaceOnboardingState,
  type ServiceMeshProfile,
} from '../../_utils/service-mesh-discovery';

type ServiceMeshBody = {
  serviceProfile?: Partial<ServiceMeshProfile> & { serviceName: string };
  namespaceOnboarding?: Partial<NamespaceOnboardingState> & { namespace: string };
  trafficProbe?: {
    callerService: string;
    targetService: string;
    tenantId?: string | null;
  };
};

function parseBody(req: ApiRequest): ServiceMeshBody {
  if (!req.body || typeof req.body !== 'object') return {};
  return req.body as ServiceMeshBody;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET', 'POST', 'PATCH', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const initialDecision = resolveGatewayCompatibility(req);
  applyCompatibilityResponseHeaders(res, initialDecision, ctx.correlationId);

  try {
    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PATCH') {
      res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
      return res.status(405).json({
        error: `Method ${req.method} Not Allowed`,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    enforceAnyPermission(auth.permissions, ['dashboards.view', 'admin.franchises.manage']);
    const access = await resolveAndApplyAccessContext(req, ctx);
    enforceRateLimit(req, access.tenantId || '');

    const rollout = resolveGatewayFeatureFlag({
      moduleKey: 'gateway.service-mesh-discovery',
      tenantId: access.tenantId,
      franchiseId: access.franchiseId,
    });
    if (!rollout.enabled) {
      return res.status(404).json({
        error: 'Service mesh controls are not enabled for this rollout cohort',
        rollout,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    const body = parseBody(req);
    if (req.method === 'PATCH') {
      if (body.serviceProfile) {
        upsertServiceMeshProfile(body.serviceProfile);
      }
      if (body.namespaceOnboarding) {
        setNamespaceOnboardingState(body.namespaceOnboarding);
      }
      logApiEvent('info', '[ServiceMeshControl] mesh configuration updated', {
        correlationId: ctx.correlationId,
        tenantId: access.tenantId || null,
      });
      return res.status(200).json({
        data: {
          summary: getMeshCoverageSummary(),
          serviceProfiles: listServiceMeshProfiles(),
          namespaceOnboarding: listNamespaceOnboardingStates(),
        },
        rollout,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    if (req.method === 'POST') {
      if (!body.trafficProbe) throw new Error('Missing trafficProbe payload');
      const decision = evaluateMeshTrafficControl({
        callerService: body.trafficProbe.callerService,
        targetService: body.trafficProbe.targetService,
        tenantId: body.trafficProbe.tenantId ?? access.tenantId,
      });
      return res.status(200).json({
        data: { decision },
        rollout,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    const serviceName = String(req.query.serviceName || '').trim();
    return res.status(200).json({
      data: {
        summary: getMeshCoverageSummary(),
        serviceProfile: serviceName ? getServiceMeshProfile(serviceName) : null,
        serviceProfiles: listServiceMeshProfiles(),
        namespaceOnboarding: listNamespaceOnboardingStates(),
      },
      rollout,
      correlationId: ctx.correlationId,
      version: 'v1',
    });
  } catch (error) {
    logApiEvent('error', '[ServiceMeshControl] failed', {
      correlationId: ctx.correlationId,
      userId: ctx.userId || null,
      tenantId: ctx.tenantId || null,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}
