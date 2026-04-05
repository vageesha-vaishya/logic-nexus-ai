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
import { getLatestUimQaSignoffRecord } from '@/modules/uim/analytics/reconciliationSignoffStore';

const DEFAULT_DASHBOARD_LATENCY_TARGET_MS = 2200;

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
    const signoff = getLatestUimQaSignoffRecord(access.tenantId, access.franchiseId || null);
    const latencyTarget = Number(process.env.UIM_ANALYTICS_DASHBOARD_LATENCY_TARGET_MS || DEFAULT_DASHBOARD_LATENCY_TARGET_MS);

    const evidenceChecks = [
      {
        key: 'kpi_model_complete',
        passed: UIM_ANALYTICS_KPI_MODEL_DEFINITIONS.length >= 7,
        details: `${UIM_ANALYTICS_KPI_MODEL_DEFINITIONS.length} KPI definitions`,
      },
      {
        key: 'semantic_dictionary_complete',
        passed: UIM_ANALYTICS_SEMANTIC_DICTIONARY.dimensions.length > 0 && UIM_ANALYTICS_SEMANTIC_DICTIONARY.measures.length > 0,
        details: `${UIM_ANALYTICS_SEMANTIC_DICTIONARY.dimensions.length} dimensions and ${UIM_ANALYTICS_SEMANTIC_DICTIONARY.measures.length} measures`,
      },
      {
        key: 'etl_failures_clear',
        passed: Number(etlTelemetry.failed_runs || 0) === 0,
        details: `failed_runs=${Number(etlTelemetry.failed_runs || 0)}`,
      },
      {
        key: 'qa_signoff_present',
        passed: Boolean(signoff && signoff.signoff_status === 'signed_off'),
        details: signoff ? `latest_signoff=${signoff.signoff_status}` : 'latest_signoff=none',
      },
      {
        key: 'replay_checkpoint_present',
        passed: Number(analytics.snapshot.replay_version || 0) > 0,
        details: `replay_version=${Number(analytics.snapshot.replay_version || 0)}`,
      },
    ];
    const passCount = evidenceChecks.filter((item) => item.passed).length;
    const readinessScore = Math.round((passCount / evidenceChecks.length) * 100);

    res.status(200).json({
      version: 'v2',
      interface: 'uim-analytics-sla-evidence',
      correlationId: ctx.correlationId,
      output: {
        tenant_id: access.tenantId,
        franchise_id: access.franchiseId || null,
        gate: 'v0.8-phase-4-exit',
        generated_at: new Date().toISOString(),
        performance_targets: {
          dashboard_latency_target_ms: Number.isFinite(latencyTarget) && latencyTarget > 0
            ? Math.floor(latencyTarget)
            : DEFAULT_DASHBOARD_LATENCY_TARGET_MS,
        },
        evidence_checks: evidenceChecks,
        readiness_score: readinessScore,
        status: readinessScore === 100 ? 'ready' : 'pending',
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
