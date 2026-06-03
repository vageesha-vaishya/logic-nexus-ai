// Phase 7 UIM Step 4b.14 — analytics ETL route.
//
// Carves src/pages/api/v2/uim/analytics/etl.ts (151 LOC) into uim-api.
//
// GET  /api/v1/uim/analytics/etl
//      Returns scheduler state + queue stats + telemetry summary +
//      last 50 runs, all scoped to the caller's tenant/franchise.
//
// POST /api/v1/uim/analytics/etl
//      Body: { action, … }
//      action ∈ { schedule-run | process-now | start-scheduler |
//                 stop-scheduler }
//      - schedule-run requires `source`. Optional window_start,
//        window_end, trigger ('manual' or 'scheduled', default
//        'manual'), max_attempts (default 4, min 1).
//      - process-now drains the queue (runs every due job once via
//        the configured executor — default no-op).
//      - start-scheduler accepts interval_ms (default 30000, min 500).
//      - stop-scheduler clears the timer.
//
// In-memory queue + executor + persistence are inherited from the
// legacy module verbatim. DB-backed persistence is a follow-up
// architectural slice.

import { Router, Response } from 'express';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ErrorResponse } from '../types/uim.types.js';
import {
  enqueueUimEtlRun,
  getUimEtlQueueStats,
  getUimEtlSchedulerState,
  getUimEtlTelemetrySummary,
  listUimEtlRuns,
  processUimEtlQueue,
  startUimEtlScheduler,
  stopUimEtlScheduler,
} from '../services/etl-scheduler.js';

const router = Router();

function unauthorized(res: Response): void {
  res.status(401).json({
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
    statusCode: 401,
  } as ErrorResponse);
}

function bad(res: Response, message: string): void {
  res.status(400).json({
    error: message,
    code: 'INVALID_REQUEST',
    statusCode: 400,
  } as ErrorResponse);
}

function parseBody(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  return {};
}

function parseInteger(value: unknown, fallback: number, min = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.floor(parsed));
}

router.get(
  '/v1/uim/analytics/etl',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);
    const filter = {
      tenantId: authReq.tenantId,
      franchiseId: authReq.franchiseId || undefined,
    };

    return res.status(200).json({
      version: 'v1',
      interface: 'uim-analytics-etl',
      output: {
        tenant_id: authReq.tenantId,
        franchise_id: authReq.franchiseId || null,
        scheduler: getUimEtlSchedulerState(),
        queue: getUimEtlQueueStats(filter),
        telemetry: getUimEtlTelemetrySummary(filter),
        runs: listUimEtlRuns(filter).slice(0, 50),
      },
    });
  }),
);

router.post(
  '/v1/uim/analytics/etl',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId || !authReq.tenantId) return unauthorized(res);
    const filter = {
      tenantId: authReq.tenantId,
      franchiseId: authReq.franchiseId || undefined,
    };

    const body = parseBody(req.body);
    const action = String(body.action || '').trim().toLowerCase();

    try {
      if (action === 'schedule-run') {
        const source = String(body.source || '').trim();
        if (!source) return bad(res, 'source is required');
        const run = await enqueueUimEtlRun({
          tenant_id: authReq.tenantId,
          franchise_id: authReq.franchiseId || null,
          source,
          window_start: body.window_start ? String(body.window_start) : undefined,
          window_end: body.window_end ? String(body.window_end) : undefined,
          trigger: String(body.trigger || '').trim().toLowerCase() === 'scheduled'
            ? 'scheduled'
            : 'manual',
          max_attempts: parseInteger(body.max_attempts, 4, 1),
        });
        return res.status(200).json({
          version: 'v1',
          interface: 'uim-analytics-etl',
          output: {
            action: 'schedule-run',
            run,
            queue: getUimEtlQueueStats(filter),
          },
        });
      }

      if (action === 'process-now') {
        await processUimEtlQueue();
        return res.status(200).json({
          version: 'v1',
          interface: 'uim-analytics-etl',
          output: {
            action: 'process-now',
            queue: getUimEtlQueueStats(filter),
            telemetry: getUimEtlTelemetrySummary(filter),
          },
        });
      }

      if (action === 'start-scheduler') {
        const intervalMs = parseInteger(body.interval_ms, 30000, 500);
        startUimEtlScheduler(intervalMs);
        return res.status(200).json({
          version: 'v1',
          interface: 'uim-analytics-etl',
          output: {
            action: 'start-scheduler',
            scheduler: getUimEtlSchedulerState(),
          },
        });
      }

      if (action === 'stop-scheduler') {
        stopUimEtlScheduler();
        return res.status(200).json({
          version: 'v1',
          interface: 'uim-analytics-etl',
          output: {
            action: 'stop-scheduler',
            scheduler: getUimEtlSchedulerState(),
          },
        });
      }

      return bad(res, 'Unsupported action. Use schedule-run, process-now, start-scheduler, or stop-scheduler');
    } catch (err) {
      logger.error('uim.analytics.etl action error', { action, error: String(err) });
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'ETL action failed',
        code: 'UIM_ANALYTICS_ETL_ACTION_ERROR',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

export default router;
