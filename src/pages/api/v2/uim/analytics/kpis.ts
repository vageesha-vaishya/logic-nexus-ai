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
  computeUimAnalyticsKpis,
  UIM_ANALYTICS_DEFAULT_LOW_STOCK_THRESHOLD,
  UIM_ANALYTICS_KPI_MODEL_DEFINITIONS,
  UIM_ANALYTICS_SEMANTIC_DICTIONARY,
} from '@/services/uim/uimAnalyticsService';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';

const DEFAULT_DASHBOARD_LATENCY_TARGET_MS = 2200;

function parseThreshold(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return UIM_ANALYTICS_DEFAULT_LOW_STOCK_THRESHOLD;
  return Math.floor(parsed);
}

function parseDashboardLatencyTarget(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DASHBOARD_LATENCY_TARGET_MS;
  return Math.floor(parsed);
}

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
    const threshold = parseThreshold(req.query.low_stock_threshold);
    const dashboardLatencyTargetMs = parseDashboardLatencyTarget(
      process.env.UIM_ANALYTICS_DASHBOARD_LATENCY_TARGET_MS,
    );
    const supabase = getSupabaseAdminClient();
    const output = await computeUimAnalyticsKpis(supabase, access, { lowStockThreshold: threshold });

    res.status(200).json({
      version: 'v2',
      interface: 'uim-analytics-kpis',
      correlationId: ctx.correlationId,
      output: {
        tenant_id: access.tenantId,
        franchise_id: access.franchiseId || null,
        low_stock_threshold: threshold,
        phase4_prep: {
          sequence: [
            'kpi-model-definitions',
            'etl-jobs',
            'dashboard-fe',
            'bi-semantic-cube-and-data-dictionary',
            'reporting-qa-and-reconciliation',
          ],
          kpi_model_definitions: UIM_ANALYTICS_KPI_MODEL_DEFINITIONS,
          semantic_dictionary: UIM_ANALYTICS_SEMANTIC_DICTIONARY,
          performance_targets: {
            dashboard_latency_target_ms: dashboardLatencyTargetMs,
            source: process.env.UIM_ANALYTICS_DASHBOARD_LATENCY_TARGET_MS ? 'environment' : 'default',
          },
        },
        ...output,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
