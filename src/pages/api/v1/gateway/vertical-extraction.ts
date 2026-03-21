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
import {
  getAclCompatibilityAdapter,
  resolveAclWritePlan,
  setAclModuleExtractionConfig,
  translateLegacySchemaRecord,
  type VerticalModuleKey,
} from '../../_utils/vertical-extraction-acl';
import { resolveGatewayFeatureFlag } from '../../_utils/gateway-feature-flags';

type ModuleConfigPatch = {
  moduleKey: VerticalModuleKey;
  extractionEnabled?: boolean;
  aclLegacyPathEnabled?: boolean;
  rollbackToLegacy?: boolean;
};

type WritePlanBody = {
  sourceModule: VerticalModuleKey;
  tableName: string;
  payload: Record<string, unknown>;
};

type TranslationBody = {
  entityKey: 'crm.lead';
  direction: 'legacy_to_canonical' | 'canonical_to_legacy';
  payload: Record<string, unknown>;
};

type PatchBody = {
  moduleConfig?: ModuleConfigPatch;
  writePlan?: WritePlanBody;
  translation?: TranslationBody;
};

function parseBody(req: ApiRequest): PatchBody {
  if (!req.body || typeof req.body !== 'object') return {};
  return req.body as PatchBody;
}

function parseModuleKey(value: unknown): VerticalModuleKey {
  const moduleKey = String(value || '').trim();
  if (moduleKey === 'module-crm' || moduleKey === 'module-logistics' || moduleKey === 'module-quotation' || moduleKey === 'module-finance') {
    return moduleKey;
  }
  throw new Error(`Invalid module key: ${moduleKey}`);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET', 'PATCH', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const initialDecision = resolveGatewayCompatibility(req);
  applyCompatibilityResponseHeaders(res, initialDecision, ctx.correlationId);

  try {
    if (req.method !== 'GET' && req.method !== 'PATCH') {
      res.setHeader('Allow', ['GET', 'PATCH']);
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
      moduleKey: 'gateway.vertical-extraction',
      tenantId: access.tenantId,
      franchiseId: access.franchiseId,
    });
    if (!rollout.enabled) {
      return res.status(404).json({
        error: 'Vertical extraction controls are not enabled for this rollout cohort',
        rollout,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    const moduleKey = parseModuleKey(req.query.moduleKey || 'module-crm');
    const body = parseBody(req);
    let moduleConfig = getAclCompatibilityAdapter(moduleKey);
    let writePlan = null as ReturnType<typeof resolveAclWritePlan> | null;
    let translationResult = null as Record<string, unknown> | null;

    if (req.method === 'PATCH') {
      if (body.moduleConfig) {
        moduleConfig = setAclModuleExtractionConfig(parseModuleKey(body.moduleConfig.moduleKey), {
          extractionEnabled: body.moduleConfig.extractionEnabled,
          aclLegacyPathEnabled: body.moduleConfig.aclLegacyPathEnabled,
          rollbackToLegacy: body.moduleConfig.rollbackToLegacy,
        });
      }
      if (body.writePlan) {
        writePlan = resolveAclWritePlan({
          sourceModule: parseModuleKey(body.writePlan.sourceModule),
          tableName: body.writePlan.tableName,
          payload: body.writePlan.payload || {},
        });
      }
      if (body.translation) {
        translationResult = translateLegacySchemaRecord(
          body.translation.entityKey,
          body.translation.direction,
          body.translation.payload || {}
        );
      }
      logApiEvent('info', '[VerticalExtractionACL] config updated', {
        correlationId: ctx.correlationId,
        tenantId: access.tenantId || null,
        franchiseId: access.franchiseId || null,
        moduleKey: moduleConfig.moduleKey,
        routePath: moduleConfig.routePath,
      });
    }

    if (!writePlan) {
      writePlan = resolveAclWritePlan({
        sourceModule: moduleConfig.moduleKey,
        tableName: String(req.query.tableName || 'leads'),
        payload: {},
      });
    }

    return res.status(200).json({
      data: {
        moduleConfig,
        writePlan,
        translationResult,
      },
      rollout,
      correlationId: ctx.correlationId,
      version: 'v1',
    });
  } catch (error) {
    logApiEvent('error', '[VerticalExtractionACL] failed', {
      correlationId: ctx.correlationId,
      userId: ctx.userId || null,
      tenantId: ctx.tenantId || null,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}
