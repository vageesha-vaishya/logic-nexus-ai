// Phase 7 UIM Step 4b.13 — analytics KPIs route.
//
// First of the 6 analytics routes. Carves
// src/pages/api/v2/uim/analytics/kpis.ts (88 LOC) into uim-api.
// Returns:
//   - The 7 computed KPIs (delegated to computeUimAnalyticsKpis)
//   - The KPI model definitions + semantic dictionary
//   - The phase4_prep sequence + dashboard_latency_target_ms
//
// Reads UIM_ANALYTICS_DASHBOARD_LATENCY_TARGET_MS env to override
// the default 2200ms target; matches legacy behavior.

import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ErrorResponse } from '../types/uim.types.js';
import {
  computeUimAnalyticsKpis,
  UIM_ANALYTICS_DEFAULT_LOW_STOCK_THRESHOLD,
  UIM_ANALYTICS_KPI_MODEL_DEFINITIONS,
  UIM_ANALYTICS_SEMANTIC_DICTIONARY,
} from '../services/analytics.service.js';

const router = Router();

const DEFAULT_DASHBOARD_LATENCY_TARGET_MS = 2200;

function unauthorized(res: Response): void {
  res.status(401).json({
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
    statusCode: 401,
  } as ErrorResponse);
}

function getServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('uim-api requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

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

router.get(
  '/v1/uim/analytics/kpis',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);

    const threshold = parseThreshold(req.query.low_stock_threshold);
    const dashboardLatencyTargetMs = parseDashboardLatencyTarget(
      process.env.UIM_ANALYTICS_DASHBOARD_LATENCY_TARGET_MS,
    );

    try {
      const supabase = getServiceRoleClient();
      const output = await computeUimAnalyticsKpis(
        supabase,
        { tenantId: authReq.tenantId, franchiseId: authReq.franchiseId || null },
        { lowStockThreshold: threshold },
      );

      return res.status(200).json({
        version: 'v1',
        interface: 'uim-analytics-kpis',
        output: {
          tenant_id: authReq.tenantId,
          franchise_id: authReq.franchiseId || null,
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
    } catch (err) {
      logger.error('uim.analytics.kpis error', { error: String(err) });
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to compute KPIs',
        code: 'UIM_ANALYTICS_KPIS_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

export default router;
