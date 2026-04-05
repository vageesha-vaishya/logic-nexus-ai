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
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import {
  computeUimAnalyticsKpis,
  UIM_ANALYTICS_DEFAULT_LOW_STOCK_THRESHOLD,
  UIM_ANALYTICS_KPI_MODEL_DEFINITIONS,
  UIM_ANALYTICS_SEMANTIC_DICTIONARY,
} from '@/services/uim/uimAnalyticsService';
import { getUimEtlTelemetrySummary } from '@/modules/uim/analytics/etlScheduler';

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
    const supabase = getSupabaseAdminClient();
    const analytics = await computeUimAnalyticsKpis(supabase, access, {
      lowStockThreshold: UIM_ANALYTICS_DEFAULT_LOW_STOCK_THRESHOLD,
    });
    const etlTelemetry = getUimEtlTelemetrySummary({
      tenantId: access.tenantId,
      franchiseId: access.franchiseId || undefined,
    });

    const checks = [
      {
        key: 'projection_replay_checkpoint',
        label: 'Projection replay checkpoint present',
        passed: Number(analytics.snapshot.replay_version || 0) > 0,
        details: `Replay version ${Number(analytics.snapshot.replay_version || 0)}`,
      },
      {
        key: 'kpi_model_definitions_available',
        label: 'KPI model definitions available',
        passed: UIM_ANALYTICS_KPI_MODEL_DEFINITIONS.length >= 7,
        details: `${UIM_ANALYTICS_KPI_MODEL_DEFINITIONS.length} KPI definitions loaded`,
      },
      {
        key: 'semantic_dictionary_available',
        label: 'BI semantic dictionary available',
        passed: UIM_ANALYTICS_SEMANTIC_DICTIONARY.dimensions.length > 0
          && UIM_ANALYTICS_SEMANTIC_DICTIONARY.measures.length > 0,
        details: `${UIM_ANALYTICS_SEMANTIC_DICTIONARY.dimensions.length} dimensions, ${UIM_ANALYTICS_SEMANTIC_DICTIONARY.measures.length} measures`,
      },
      {
        key: 'etl_failure_clear',
        label: 'ETL failure queue clear',
        passed: Number(etlTelemetry.failed_runs || 0) === 0,
        details: `Failed runs ${Number(etlTelemetry.failed_runs || 0)}`,
      },
      {
        key: 'etl_completed_run_seen',
        label: 'At least one ETL completion observed',
        passed: Number(etlTelemetry.completed_runs || 0) > 0,
        details: `Completed runs ${Number(etlTelemetry.completed_runs || 0)}`,
      },
    ];

    const passedCount = checks.filter((item) => item.passed).length;
    const score = Math.round((passedCount / checks.length) * 100);
    const status = passedCount === checks.length ? 'ready' : 'pending';

    res.status(200).json({
      version: 'v2',
      interface: 'uim-analytics-reconciliation',
      correlationId: ctx.correlationId,
      output: {
        tenant_id: access.tenantId,
        franchise_id: access.franchiseId || null,
        readiness: {
          status,
          score,
          checks,
        },
        snapshot: {
          replay_version: Number(analytics.snapshot.replay_version || 0),
          generated_at: analytics.snapshot.generated_at,
          etl_completed_runs: Number(etlTelemetry.completed_runs || 0),
          etl_failed_runs: Number(etlTelemetry.failed_runs || 0),
        },
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
