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
  enqueueUimEtlRun,
  getUimEtlQueueStats,
  getUimEtlSchedulerState,
  getUimEtlTelemetrySummary,
  listUimEtlRuns,
  processUimEtlQueue,
  startUimEtlScheduler,
  stopUimEtlScheduler,
} from '@/modules/uim/analytics/etlScheduler';

function parseBody(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  return {};
}

function parseInteger(value: unknown, fallback: number, min = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.floor(parsed));
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);

  try {
    enforceHttps(req);
    enforceRateLimit(req);
    const access = await resolveUimAccess(req, ctx);
    const filter = { tenantId: access.tenantId, franchiseId: access.franchiseId || undefined };

    if (req.method === 'GET') {
      res.status(200).json({
        version: 'v2',
        interface: 'uim-analytics-etl',
        correlationId: ctx.correlationId,
        output: {
          tenant_id: access.tenantId,
          franchise_id: access.franchiseId || null,
          scheduler: getUimEtlSchedulerState(),
          queue: getUimEtlQueueStats(filter),
          telemetry: getUimEtlTelemetrySummary(filter),
          runs: listUimEtlRuns(filter).slice(0, 50),
        },
      });
      return;
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({
        error: `Method ${req.method} Not Allowed`,
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    const body = parseBody(req.body);
    const action = String(body.action || '').trim().toLowerCase();

    if (action === 'schedule-run') {
      const source = String(body.source || '').trim();
      if (!source) throw new Error('source is required');
      const run = await enqueueUimEtlRun({
        tenant_id: access.tenantId,
        franchise_id: access.franchiseId || null,
        source,
        window_start: body.window_start ? String(body.window_start) : undefined,
        window_end: body.window_end ? String(body.window_end) : undefined,
        trigger: String(body.trigger || '').trim().toLowerCase() === 'scheduled' ? 'scheduled' : 'manual',
        max_attempts: parseInteger(body.max_attempts, 4, 1),
      });
      res.status(200).json({
        version: 'v2',
        interface: 'uim-analytics-etl',
        correlationId: ctx.correlationId,
        output: {
          action: 'schedule-run',
          run,
          queue: getUimEtlQueueStats(filter),
        },
      });
      return;
    }

    if (action === 'process-now') {
      await processUimEtlQueue();
      res.status(200).json({
        version: 'v2',
        interface: 'uim-analytics-etl',
        correlationId: ctx.correlationId,
        output: {
          action: 'process-now',
          queue: getUimEtlQueueStats(filter),
          telemetry: getUimEtlTelemetrySummary(filter),
        },
      });
      return;
    }

    if (action === 'start-scheduler') {
      const intervalMs = parseInteger(body.interval_ms, 30000, 500);
      startUimEtlScheduler(intervalMs);
      res.status(200).json({
        version: 'v2',
        interface: 'uim-analytics-etl',
        correlationId: ctx.correlationId,
        output: {
          action: 'start-scheduler',
          scheduler: getUimEtlSchedulerState(),
        },
      });
      return;
    }

    if (action === 'stop-scheduler') {
      stopUimEtlScheduler();
      res.status(200).json({
        version: 'v2',
        interface: 'uim-analytics-etl',
        correlationId: ctx.correlationId,
        output: {
          action: 'stop-scheduler',
          scheduler: getUimEtlSchedulerState(),
        },
      });
      return;
    }

    res.status(400).json({
      error: 'Unsupported action. Use schedule-run, process-now, start-scheduler, or stop-scheduler',
      version: 'v2',
      correlationId: ctx.correlationId,
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
