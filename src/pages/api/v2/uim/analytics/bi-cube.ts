import { createHash } from 'node:crypto';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import {
  applyCors,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
} from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import { resolveUimAccess } from '../_shared';
import {
  UIM_ANALYTICS_KPI_MODEL_DEFINITIONS,
  UIM_ANALYTICS_SEMANTIC_DICTIONARY,
} from '@/services/uim/uimAnalyticsService';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);

  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      res.status(405).json({
        error: `Method ${req.method} Not Allowed`,
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const access = await resolveUimAccess(req, ctx);

    const artifactPayload = {
      cube: UIM_ANALYTICS_SEMANTIC_DICTIONARY,
      kpi_model_definitions: UIM_ANALYTICS_KPI_MODEL_DEFINITIONS,
      generated_at: new Date().toISOString(),
    };
    const artifactHash = createHash('sha256').update(JSON.stringify(artifactPayload)).digest('hex');

    res.status(200).json({
      version: 'v2',
      interface: 'uim-analytics-bi-cube',
      correlationId: ctx.correlationId,
      output: {
        tenant_id: access.tenantId,
        franchise_id: access.franchiseId || null,
        deployment_artifact: {
          artifact_id: `uim-bi-cube-${artifactHash.slice(0, 12)}`,
          artifact_hash: artifactHash,
          artifact_version: UIM_ANALYTICS_SEMANTIC_DICTIONARY.version,
          published_at: artifactPayload.generated_at,
          deployment_target: 'uim_inventory_analytics_cube',
        },
        data_dictionary: {
          cube_name: UIM_ANALYTICS_SEMANTIC_DICTIONARY.cube_name,
          dimensions: UIM_ANALYTICS_SEMANTIC_DICTIONARY.dimensions,
          measures: UIM_ANALYTICS_SEMANTIC_DICTIONARY.measures,
          kpi_model_definitions: UIM_ANALYTICS_KPI_MODEL_DEFINITIONS,
          publication_status: 'published',
        },
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
