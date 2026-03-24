/**
 * Express Application Setup
 * Middleware and route initialization
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { authMiddleware, AuthRequest } from './middleware/auth.middleware';
import masterDataRoutes from './routes/master-data.routes';
import workOrdersRoutes from './routes/work-orders.routes';
import { ErrorResponse } from './types/amro.types';
import { logger } from './utils/logger';
import { amroEventsProducer } from './events/amro-events.producer';
import { executeWithResilience, getResilienceStatus } from './utils/resilience';

const app: Express = express();
type JsonRecord = Record<string, unknown>;

function resolveContractsDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'src/pages/api/v2/amro/contracts'),
    path.resolve(process.cwd(), '..', 'src/pages/api/v2/amro/contracts'),
    path.resolve(process.cwd(), '..', '..', 'src/pages/api/v2/amro/contracts'),
  ];
  const matched = candidates.find((candidate) => existsSync(candidate));
  if (!matched) {
    throw new Error('AMRO contract artifacts directory not found');
  }
  return matched;
}

const TABLE_FALLBACK_CANDIDATES: Record<string, string[]> = {
  work_package_master: ['work_packages'],
  materials_inventory: ['parts_inventory', 'work_package_materials'],
  compliance_gates: ['compliance_records', 'compliance_obligations'],
  integration_logs: ['integration_jobs', 'webhook_outbox'],
  forecast_recommendations: ['forecast_outputs', 'forecast_decisions'],
  task_execution_status: ['tasks'],
  scheduling_board_data: ['schedules'],
  certification_records: ['certification_actions'],
  audit_trails: ['maintenance_events'],
};

const monitoringOptions = {
  windowMs: Number(process.env.AMRO_MONITORING_WINDOW_MS || 300000),
  minSamples: Number(process.env.AMRO_MONITORING_MIN_SAMPLES || 40),
  alert5xxPercent: Number(process.env.AMRO_MONITORING_ALERT_5XX_PERCENT || 1),
  minAlertIntervalMs: Number(process.env.AMRO_MONITORING_MIN_ALERT_INTERVAL_MS || 60000),
};

const monitoringState = {
  totalRequests: 0,
  total4xx: 0,
  total5xx: 0,
  lastAlertAt: 0,
  window: [] as Array<{ at: number; statusCode: number }>,
};

function parseFlag(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isOverviewKpiEnabled(): boolean {
  return parseFlag(process.env.AMRO_OVERVIEW_KPI_V2_ENABLED, true);
}

function resolveSupabaseCredentials(): { url: string; serviceKey: string } {
  const url = String(
    process.env.AMRO_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      '',
  ).replace(/\/$/, '');
  const serviceKey = String(
    process.env.AMRO_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      '',
  ).trim();
  return { url, serviceKey };
}

function getSupabaseAdminClient(): SupabaseClient {
  const { url, serviceKey } = resolveSupabaseCredentials();
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  return createClient(url, serviceKey);
}

function recordMonitoringStatus(statusCode: number, requestId: string, pathName: string): void {
  const now = Date.now();
  monitoringState.totalRequests += 1;
  if (statusCode >= 400 && statusCode < 500) monitoringState.total4xx += 1;
  if (statusCode >= 500) monitoringState.total5xx += 1;
  monitoringState.window.push({ at: now, statusCode });
  monitoringState.window = monitoringState.window.filter((entry) => now - entry.at <= monitoringOptions.windowMs);
  const sampleCount = monitoringState.window.length;
  const sample5xx = monitoringState.window.filter((entry) => entry.statusCode >= 500).length;
  const ratePercent = sampleCount > 0 ? (sample5xx / sampleCount) * 100 : 0;
  const shouldAlert = sampleCount >= monitoringOptions.minSamples
    && ratePercent >= monitoringOptions.alert5xxPercent
    && now - monitoringState.lastAlertAt >= monitoringOptions.minAlertIntervalMs;
  if (shouldAlert) {
    monitoringState.lastAlertAt = now;
    logger.error('[Monitoring Alert] Elevated 5xx rate on AMRO API', {
      requestId,
      path: pathName,
      windowMs: monitoringOptions.windowMs,
      sampleCount,
      sample5xx,
      ratePercent: Number(ratePercent.toFixed(2)),
      thresholdPercent: monitoringOptions.alert5xxPercent,
    });
  }
}

async function probeSupabaseDependency(requestId: string): Promise<{ ok: boolean; latencyMs: number; message?: string }> {
  const startedAt = Date.now();
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await executeWithResilience(
      {
        dependency: 'supabase',
        operation: 'health.probe',
        requestId,
      },
      async () =>
        await supabase
          .from('profiles')
          .select('id')
          .limit(1),
    );
    if (error) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        message: String(error.message || 'Supabase probe failed'),
      };
    }
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      message: String((error as { message?: unknown } | null)?.message || 'Supabase probe failed'),
    };
  }
}

function parseDateMs(value: unknown): number {
  if (!value) return Number.NaN;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function getStringValue(row: JsonRecord, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return fallback;
}

function getNumericValue(row: JsonRecord, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 1) return Math.max(0, Math.min(100, value * 100));
  return Math.max(0, Math.min(100, value));
}

function resolveStatus(row: JsonRecord): string {
  return getStringValue(
    row,
    ['status', 'state', 'workflow_state', 'execution_status', 'compliance_status', 'certification_status', 'result_status'],
  ).toLowerCase();
}

function isResolvedStatus(status: string): boolean {
  return ['completed', 'closed', 'resolved', 'released', 'approved', 'passed'].includes(status);
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseDateRange(value: unknown): { from: string; to: string } {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error('date_range is required');
  }
  if (normalized.includes('|')) {
    const [from = '', to = ''] = normalized.split('|');
    const fromDate = Date.parse(from.trim());
    const toDate = Date.parse(to.trim());
    if (!Number.isFinite(fromDate) || !Number.isFinite(toDate) || fromDate > toDate) {
      throw new Error('Invalid date_range format. Expected ISO start|end');
    }
    return { from: from.trim(), to: to.trim() };
  }
  throw new Error('Invalid date_range format. Expected ISO start|end');
}

async function fetchScopedRows(
  table: string,
  tenantId: string,
  limit: number,
  issueCollector: string[],
): Promise<JsonRecord[]> {
  const tableCandidates = [table, ...(TABLE_FALLBACK_CANDIDATES[table] || [])];
  let fallbackErrorMessage = '';

  const isMissingTableError = (message: string, code: string) =>
    code === 'PGRST205'
    || message.toLowerCase().includes('could not find the table')
    || (message.toLowerCase().includes('relation') && message.toLowerCase().includes('does not exist'));
  const isInvalidTenantUuidError = (message: string) =>
    message.toLowerCase().includes('invalid input syntax for type uuid');

  try {
    for (const [index, tableCandidate] of tableCandidates.entries()) {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from(tableCandidate)
        .select('*')
        .eq('tenant_id', tenantId)
        .limit(limit);
      if (!error) {
        return Array.isArray(data) ? (data as JsonRecord[]) : [];
      }
      const message = String(error.message || 'database connectivity failure');
      const code = String((error as { code?: string }).code || '');
      if (process.env.NODE_ENV !== 'production' && isInvalidTenantUuidError(message)) {
        const fallbackResult = await supabase
          .from(tableCandidate)
          .select('*')
          .limit(limit);
        if (!fallbackResult.error) {
          issueCollector.push(`${table}: tenant scope fallback applied for non-UUID tenant_id in development`);
          return Array.isArray(fallbackResult.data) ? (fallbackResult.data as JsonRecord[]) : [];
        }
      }
      if (!fallbackErrorMessage) {
        fallbackErrorMessage = `${table}: ${message}`;
      }
      const allowFallback = index < tableCandidates.length - 1 && isMissingTableError(message, code);
      if (allowFallback) {
        continue;
      }
      issueCollector.push(`${table}: ${message}`);
      return [];
    }
    if (fallbackErrorMessage) {
      issueCollector.push(fallbackErrorMessage);
    }
    return [];
  } catch (error) {
    issueCollector.push(`${table}: ${error instanceof Error ? error.message : 'database connectivity failure'}`);
    return [];
  }
}

function buildTrendSeries(rows: JsonRecord[], window: '7d' | '30d' | '90d') {
  const days = window === '7d' ? 7 : window === '90d' ? 90 : 30;
  const histogram = new Map<string, number>();
  const today = new Date();
  for (const row of rows) {
    const timestamp = getStringValue(row, ['completed_at', 'updated_at', 'created_at']);
    const day = new Date(timestamp);
    if (Number.isNaN(day.getTime())) continue;
    const key = day.toISOString().slice(0, 10);
    histogram.set(key, (histogram.get(key) || 0) + 1);
  }
  return Array.from({ length: days }).map((_, index) => {
    const current = new Date(today);
    current.setDate(today.getDate() - (days - index - 1));
    const day = current.toISOString().slice(0, 10);
    return { date: day, value: histogram.get(day) || 0 };
  });
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Parse JSON bodies
app.use(express.json());

// CORS Configuration
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-user-id',
      'x-tenant-id',
      'x-franchise-id',
      'x-domain-id',
      'x-user-role',
      'x-user-permissions',
    ],
  }),
);

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  const startedAt = Date.now();
  res.setHeader('x-request-id', requestId);

  logger.info('Request started', {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  res.on('finish', () => {
    recordMonitoringStatus(res.statusCode, requestId, req.path);
    logger.info('Request finished', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
});

const requestTimeoutMs = Number(process.env.AMRO_REQUEST_TIMEOUT_MS || 15000);
app.use((req: Request, res: Response, next: NextFunction) => {
  const isStreamingRequest = req.path.includes('/stream') || String(req.headers.accept || '').includes('text/event-stream');
  if (isStreamingRequest) {
    next();
    return;
  }
  const requestId = String(res.getHeader('x-request-id') || req.header('x-request-id') || crypto.randomUUID());
  const timeoutHandle = setTimeout(() => {
    if (res.headersSent) return;
    logger.error('Request timeout', {
      requestId,
      method: req.method,
      path: req.path,
      timeoutMs: requestTimeoutMs,
    });
    res.status(408).json({
      error: 'Request timeout',
      code: 'REQUEST_TIMEOUT',
      statusCode: 408,
      requestId,
    } as ErrorResponse);
  }, requestTimeoutMs);
  res.on('finish', () => clearTimeout(timeoutHandle));
  next();
});

// ============================================================================
// HEALTH CHECK ENDPOINTS
// ============================================================================

/**
 * GET /health
 * Service health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'amro-api',
    timestamp: new Date().toISOString(),
    uptimeSec: Math.floor(process.uptime()),
    resilience: getResilienceStatus(),
  });
});

app.get('/health/metrics', (_req: Request, res: Response) => {
  const now = Date.now();
  const window = monitoringState.window.filter((entry) => now - entry.at <= monitoringOptions.windowMs);
  const sampleCount = window.length;
  const sample5xx = window.filter((entry) => entry.statusCode >= 500).length;
  const sample4xx = window.filter((entry) => entry.statusCode >= 400 && entry.statusCode < 500).length;
  const rate5xxPercent = sampleCount > 0 ? (sample5xx / sampleCount) * 100 : 0;
  res.status(200).json({
    status: 'ok',
    totals: {
      requests: monitoringState.totalRequests,
      errors4xx: monitoringState.total4xx,
      errors5xx: monitoringState.total5xx,
    },
    window: {
      sampleCount,
      errors4xx: sample4xx,
      errors5xx: sample5xx,
      error5xxRatePercent: Number(rate5xxPercent.toFixed(2)),
      windowMs: monitoringOptions.windowMs,
    },
    threshold: {
      minSamples: monitoringOptions.minSamples,
      alert5xxPercent: monitoringOptions.alert5xxPercent,
    },
    resilience: getResilienceStatus(),
  });
});

app.get('/health/ready', async (req: Request, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  const supabase = await probeSupabaseDependency(requestId);
  const readiness = supabase.ok;
  res.status(readiness ? 200 : 503).json({
    status: readiness ? 'ready' : 'degraded',
    requestId,
    dependencies: {
      supabase,
    },
    resilience: getResilienceStatus(),
  });
});

/**
 * GET /
 * Root endpoint
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'AMRO API Service',
    version: '0.1.0',
    description: 'Asset Maintenance, Repair, and Overhaul backend service',
  });
});

app.get('/api/v2/amro/contracts/:artifact', (req: Request, res: Response) => {
  const artifact = String(req.params.artifact || '').trim();
  const allowedArtifacts = new Set([
    'openapi-3.1.yaml',
    'asyncapi-2.6.yaml',
    'amro-v1.proto',
    'amro-subgraph.graphql',
  ]);
  if (!allowedArtifacts.has(artifact)) {
    res.status(404).json({
      error: 'Not Found',
      code: 'NOT_FOUND',
      statusCode: 404,
      path: req.path,
    } as ErrorResponse);
    return;
  }

  const contentTypeByArtifact: Record<string, string> = {
    'openapi-3.1.yaml': 'application/yaml; charset=utf-8',
    'asyncapi-2.6.yaml': 'application/yaml; charset=utf-8',
    'amro-v1.proto': 'application/protobuf; charset=utf-8',
    'amro-subgraph.graphql': 'application/graphql; charset=utf-8',
  };
  const contractsDir = resolveContractsDir();
  const filePath = path.join(contractsDir, artifact);
  const content = readFileSync(filePath, 'utf8');
  res.setHeader('Content-Type', contentTypeByArtifact[artifact] || 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(content);
});

app.get('/api/v2/amro/phase-plan', (req: Request, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  res.status(200).json({
    version: 'v2',
    mode: 'phase-plan',
    requestId,
    domainAccess: {
      subscriptionStatus: 'public',
      source: 'public',
      validatedAt: new Date().toISOString(),
    },
  });
});

app.get('/api/v2/amro/phase-1-readiness', (req: Request, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  res.status(200).json({
    version: 'v2',
    mode: 'phase-1-readiness',
    requestId,
    domainAccess: {
      subscriptionStatus: 'public',
      source: 'public',
      validatedAt: new Date().toISOString(),
    },
  });
});

app.get('/api/v2/amro/module-catalog', (req: Request, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  res.status(200).json({
    version: 'v2',
    mode: 'module-catalog',
    requestId,
    domainAccess: {
      subscriptionStatus: 'public',
      source: 'public',
      validatedAt: new Date().toISOString(),
    },
  });
});

app.get('/api/v2/amro/screen-inventory', (req: Request, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  res.status(200).json({
    version: 'v2',
    mode: 'screen-inventory',
    requestId,
    domainAccess: {
      subscriptionStatus: 'public',
      source: 'public',
      validatedAt: new Date().toISOString(),
    },
  });
});

app.get('/api/v2/amro/migration-plan', (req: Request, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  res.status(200).json({
    version: 'v2',
    mode: 'migration-plan',
    requestId,
    domainAccess: {
      subscriptionStatus: 'public',
      source: 'public',
      validatedAt: new Date().toISOString(),
    },
  });
});

app.get('/api/v2/amro/health', async (req: Request, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  const supabase = await probeSupabaseDependency(requestId);
  const status = supabase.ok ? 'ok' : 'degraded';
  res.status(200).json({
    version: 'v2',
    mode: 'health',
    status,
    requestId,
    dependencies: {
      supabase,
    },
    resilience: getResilienceStatus(),
    domainAccess: {
      subscriptionStatus: 'public',
      source: 'public',
      validatedAt: new Date().toISOString(),
    },
  });
});

app.get('/api/v2/amro/health/metrics', (_req: Request, res: Response) => {
  const now = Date.now();
  const window = monitoringState.window.filter((entry) => now - entry.at <= monitoringOptions.windowMs);
  const sampleCount = window.length;
  const sample5xx = window.filter((entry) => entry.statusCode >= 500).length;
  const rate5xxPercent = sampleCount > 0 ? (sample5xx / sampleCount) * 100 : 0;
  res.status(200).json({
    version: 'v2',
    mode: 'metrics',
    status: 'ok',
    window: {
      sampleCount,
      errors5xx: sample5xx,
      error5xxRatePercent: Number(rate5xxPercent.toFixed(2)),
      windowMs: monitoringOptions.windowMs,
    },
    totals: {
      requests: monitoringState.totalRequests,
      errors4xx: monitoringState.total4xx,
      errors5xx: monitoringState.total5xx,
    },
    resilience: getResilienceStatus(),
  });
});

app.all('/api/v2/amro/overview-kpi', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({
        error: `Method ${req.method} Not Allowed`,
        statusCode: 405,
        requestId,
        version: 'v2',
      });
      return;
    }
    if (!isOverviewKpiEnabled()) {
      res.status(404).json({
        error: 'AMRO overview KPI v2 endpoint is disabled',
        statusCode: 404,
        requestId,
        version: 'v2',
      });
      return;
    }
    const tenantId = String(req.tenantId || '').trim();
    if (!tenantId) {
      res.status(401).json({
        error: 'Missing tenant context',
        code: 'MISSING_TENANT',
        statusCode: 401,
        requestId,
      });
      return;
    }

    const interfaceName = String(req.query.interface || '').trim().toLowerCase();
    const stationIds = parseStringArray(req.query.station_ids).map((id) => `${tenantId}:${id}`);
    const fleetIds = parseStringArray(req.query.fleet_ids).map((id) => `${tenantId}:${id}`);
    const plannerId = String(req.query.planner_id || '').trim() || null;
    const engineerId = String(req.query.engineer_id || '').trim() || null;

    if (req.method === 'GET' && interfaceName === 'load-kpi-dashboard') {
      const dateRange = parseDateRange(req.query.date_range);
      const dataIssues: string[] = [];
      const [workPackageRows, materialsRows, complianceRows, integrationRows, forecastRows] = await Promise.all([
        fetchScopedRows('work_package_master', tenantId, 200, dataIssues),
        fetchScopedRows('materials_inventory', tenantId, 200, dataIssues),
        fetchScopedRows('compliance_gates', tenantId, 200, dataIssues),
        fetchScopedRows('integration_logs', tenantId, 200, dataIssues),
        fetchScopedRows('forecast_recommendations', tenantId, 200, dataIssues),
      ]);

      const filteredWorkPackages = workPackageRows.filter((row) => {
        const planner = getStringValue(row, ['planner_id', 'assigned_planner_id', 'assigned_to']);
        const engineer = getStringValue(row, ['engineer_id', 'assigned_engineer_id', 'lead_engineer_id']);
        const plannerPass = !plannerId || planner === plannerId;
        const engineerPass = !engineerId || engineer === engineerId;
        return plannerPass && engineerPass;
      });
      const now = Date.now();
      const activeWorkPackages = filteredWorkPackages.filter((row) => !isResolvedStatus(resolveStatus(row))).length;
      const overdueTasks = filteredWorkPackages.filter((row) => {
        const dueMs = parseDateMs(getStringValue(row, ['due_at', 'planned_end_at', 'target_end_at', 'planned_end', 'scheduled_end_at']));
        return Number.isFinite(dueMs) && dueMs < now && !isResolvedStatus(resolveStatus(row));
      }).length;
      const compliancePassed = complianceRows.filter((row) => ['passed', 'approved', 'resolved'].includes(resolveStatus(row))).length;
      const compliancePct = complianceRows.length ? (compliancePassed / complianceRows.length) * 100 : 0;
      const forecastRecommendations = forecastRows
        .map((row) => ({
          recommendation_id: getStringValue(row, ['id', 'recommendation_id'], 'forecast'),
          work_package_id: getStringValue(row, ['work_package_id', 'package_id'], 'unknown-work-package'),
          recommendation: getStringValue(row, ['recommendation', 'action', 'suggested_action'], 'Review intervention plan'),
          confidence_pct: Math.round(normalizePercent(getNumericValue(row, ['confidence_pct', 'confidence_score'], 0)) * 10) / 10,
          risk_score: Math.round(normalizePercent(getNumericValue(row, ['risk_score', 'risk_pct'], 0)) * 10) / 10,
          reason: getStringValue(row, ['reason', 'explainability', 'rationale'], 'Model-derived recommendation'),
        }))
        .sort((left, right) => right.risk_score - left.risk_score)
        .slice(0, 10);
      const forecastAccuracy = forecastRecommendations.length
        ? forecastRecommendations.reduce((sum, item) => sum + item.confidence_pct, 0) / forecastRecommendations.length
        : 0;
      const workPackageOverview = filteredWorkPackages.slice(0, 15).map((row) => ({
        work_package_id: getStringValue(row, ['id', 'work_package_id', 'code', 'work_package_number'], 'unknown-work-package'),
        title: getStringValue(row, ['title', 'name', 'description', 'work_package_number'], 'Untitled work package'),
        status: resolveStatus(row) || 'unknown',
        planner_id: getStringValue(row, ['planner_id', 'assigned_planner_id', 'assigned_to'], 'unassigned'),
        engineer_id: getStringValue(row, ['engineer_id', 'assigned_engineer_id', 'lead_engineer_id'], 'unassigned'),
        due_at: getStringValue(row, ['due_at', 'planned_end_at', 'target_end_at', 'planned_end', 'scheduled_end_at'], ''),
        progress_pct: Math.round(normalizePercent(getNumericValue(row, ['progress_pct', 'completion_pct', 'completion_percentage'], 0))),
      }));
      const materialsAlerts = materialsRows
        .map((row) => {
          const available = getNumericValue(row, ['available_qty', 'quantity_available', 'on_hand_qty'], 0);
          const reserved = getNumericValue(row, ['reserved_qty', 'quantity_reserved', 'quantity_required', 'allocated_quantity'], 0);
          const reorderPoint = getNumericValue(row, ['reorder_point', 'minimum_qty'], 0);
          const shortage = Math.max(0, Math.max(reserved - available, reorderPoint - available));
          return {
            part_number: getStringValue(row, ['part_number', 'sku', 'material_code', 'part_id'], 'unknown-part'),
            location: getStringValue(row, ['station_id', 'warehouse_id', 'location', 'storage_location'], 'unknown-location'),
            available_qty: available,
            reserved_qty: reserved,
            shortage_qty: shortage,
          };
        })
        .filter((item) => item.shortage_qty > 0)
        .sort((left, right) => right.shortage_qty - left.shortage_qty)
        .slice(0, 10);
      const complianceAttention = complianceRows
        .map((row) => ({
          gate_id: getStringValue(row, ['id', 'gate_id', 'compliance_gate_id'], 'unknown-gate'),
          gate_name: getStringValue(row, ['gate_name', 'name', 'directive_id'], 'Compliance Gate'),
          status: resolveStatus(row) || 'unknown',
          due_at: getStringValue(row, ['due_at', 'deadline_at', 'target_at'], ''),
          owner_id: getStringValue(row, ['owner_id', 'inspector_id', 'assigned_to'], 'unassigned'),
        }))
        .filter((item) => ['failed', 'blocked', 'open', 'pending', 'at_risk'].includes(item.status))
        .slice(0, 10);
      let failedAttempts = 0;
      const recentFailures = integrationRows
        .map((row) => ({
          integration_id: getStringValue(row, ['integration_id', 'adapter_id', 'id'], 'integration'),
          status: resolveStatus(row) || 'unknown',
          direction: getStringValue(row, ['direction', 'flow'], 'bidirectional'),
          last_attempt_at: getStringValue(row, ['last_attempt_at', 'updated_at', 'created_at'], ''),
          error_message: getStringValue(row, ['error_message', 'failure_reason'], ''),
        }))
        .filter((entry) => {
          const failed = ['failed', 'error', 'timeout', 'blocked'].includes(entry.status);
          if (failed) failedAttempts += 1;
          return failed;
        })
        .slice(0, 8);
      const failureRate = integrationRows.length ? (failedAttempts / integrationRows.length) * 100 : 0;

      res.status(200).json({
        version: 'v2',
        interface: 'load-kpi-dashboard',
        requestId,
        input: {
          date_range: dateRange,
          station_ids: stationIds,
          fleet_ids: fleetIds,
          regulator_profile: String(req.query.regulator_profile || '').trim() || 'FAA',
          planner_id: plannerId,
          engineer_id: engineerId,
        },
        output: {
          executive_summary: {
            active_work_packages: activeWorkPackages,
            overdue_tasks: overdueTasks,
            compliance_status_pct: Math.round(compliancePct * 10) / 10,
            forecast_accuracy_pct: Math.round(forecastAccuracy * 10) / 10,
          },
          kpi_cards: [
            { key: 'open_work_packages', label: 'Open Work Packages', value: activeWorkPackages, trend: activeWorkPackages > 0 ? '+2%' : '0%' },
            { key: 'overdue_tasks', label: 'Overdue Tasks', value: overdueTasks, trend: overdueTasks > 0 ? '+1%' : '0%' },
            { key: 'compliance_status_pct', label: 'Compliance Status %', value: Math.round(compliancePct * 10) / 10, trend: compliancePct >= 95 ? '+0.5%' : '-0.8%' },
            { key: 'forecast_accuracy_pct', label: 'Forecast Accuracy %', value: Math.round(forecastAccuracy * 10) / 10, trend: forecastAccuracy >= 90 ? '+1.2%' : '-0.4%' },
          ],
          risk_heatmap: {
            cells: complianceAttention.slice(0, 8).map((item, index) => ({
              station: workPackageOverview[index]?.planner_id || stationIds[index] || `${tenantId}:station-${index + 1}`,
              severity: item.status === 'failed' ? 'high' : item.status === 'blocked' ? 'medium' : 'low',
              score: item.status === 'failed' ? 90 : item.status === 'blocked' ? 65 : 30,
            })),
          },
          trend_lines: [],
          anomaly_flags: recentFailures.slice(0, 3).map((failure, index) => ({
            id: `${tenantId}-anomaly-${index + 1}`,
            metric_key: 'integration_failures',
            severity: failure.status === 'timeout' ? 'medium' : 'high',
            message: failure.error_message || `Integration ${failure.integration_id} reported ${failure.status}`,
          })),
          work_package_overview: workPackageOverview,
          materials_reservation_alerts: materialsAlerts,
          compliance_gate_status: complianceAttention,
          integration_monitor: {
            status: failureRate > 15 ? 'degraded' : 'healthy',
            failed_attempts: failedAttempts,
            failure_rate_pct: Math.round(failureRate * 10) / 10,
            recent_failures: recentFailures,
          },
          screen_modules: {
            total_modules: 12,
            management_and_planner_landing: true,
          },
          data_issues: dataIssues,
          freshness_warning: null,
        },
      });
      return;
    }

    if (req.method === 'GET' && interfaceName === 'load-operational-trends') {
      const dataIssues: string[] = [];
      const metricKey = String(req.query.metric_key || '').trim() || 'schedule_adherence';
      const window = String(req.query.window || '').trim().toLowerCase();
      const normalizedWindow: '7d' | '30d' | '90d' = window === '7d' || window === '90d' ? window : '30d';
      const compareWindow = String(req.query.compare_window || '').trim() || '30d';
      const [taskRows, schedulingRows, certificationRows, auditRows, forecastRows] = await Promise.all([
        fetchScopedRows('task_execution_status', tenantId, 400, dataIssues),
        fetchScopedRows('scheduling_board_data', tenantId, 200, dataIssues),
        fetchScopedRows('certification_records', tenantId, 200, dataIssues),
        fetchScopedRows('audit_trails', tenantId, 300, dataIssues),
        fetchScopedRows('forecast_recommendations', tenantId, 200, dataIssues),
      ]);

      const timeSeries = buildTrendSeries(taskRows, normalizedWindow);
      const baseline = Math.round(timeSeries.reduce((sum, point) => sum + point.value, 0) / Math.max(1, timeSeries.length));
      const variance = Math.round((timeSeries[timeSeries.length - 1].value - baseline) * 100) / 100;
      const technicianIds = new Set<string>();
      let completedCount = 0;
      let mobileCompletedCount = 0;
      let productivitySum = 0;
      let productivityCount = 0;
      for (const row of taskRows) {
        const technicianId = getStringValue(row, ['technician_id', 'assignee_id']);
        if (technicianId) technicianIds.add(technicianId);
        const status = resolveStatus(row);
        const completed = isResolvedStatus(status) || !!row.completed_at;
        if (completed) completedCount += 1;
        const mobileCompleted = Boolean(row.completed_on_mobile || row.mobile_completed || row.mobile_submission);
        if (completed && mobileCompleted) mobileCompletedCount += 1;
        const productivity = getNumericValue(row, ['productivity_score', 'efficiency_score', 'productivity_pct'], Number.NaN);
        if (Number.isFinite(productivity)) {
          productivitySum += productivity;
          productivityCount += 1;
        }
      }
      const upcomingSlots = schedulingRows
        .map((row) => ({
          slot_id: getStringValue(row, ['id', 'slot_id'], 'slot-unknown'),
          station: getStringValue(row, ['station_id', 'station', 'hangar'], 'unspecified'),
          start_at: getStringValue(row, ['slot_start_at', 'start_at', 'scheduled_start_at'], ''),
          end_at: getStringValue(row, ['slot_end_at', 'end_at', 'scheduled_end_at'], ''),
          resource: getStringValue(row, ['resource_name', 'team_name', 'resource_id'], 'resource'),
          utilization_pct: Math.round(normalizePercent(getNumericValue(row, ['utilization_pct', 'resource_utilization'], 0)) * 10) / 10,
        }))
        .slice(0, 12);
      const utilizationSamples = schedulingRows
        .map((row) => normalizePercent(getNumericValue(row, ['utilization_pct', 'resource_utilization'], Number.NaN)))
        .filter((value) => Number.isFinite(value));
      const certificationQueue = certificationRows
        .map((row) => ({
          certification_id: getStringValue(row, ['id', 'certification_id'], 'unknown-certification'),
          work_package_id: getStringValue(row, ['work_package_id', 'package_id'], 'unknown-work-package'),
          authority: getStringValue(row, ['authority', 'certifying_authority', 'regulator'], 'unspecified'),
          status: resolveStatus(row) || 'unknown',
          submitted_at: getStringValue(row, ['submitted_at', 'created_at'], ''),
        }))
        .filter((item) => ['pending', 'in_review', 'awaiting_signature', 'queued'].includes(item.status))
        .slice(0, 10);
      const auditTimeline = auditRows
        .map((row) => ({
          event_id: getStringValue(row, ['id', 'event_id', 'audit_id'], 'unknown-event'),
          action: getStringValue(row, ['action', 'event_type', 'activity'], 'audit-event'),
          actor: getStringValue(row, ['actor', 'actor_id', 'performed_by'], 'system'),
          created_at: getStringValue(row, ['created_at', 'event_at', 'recorded_at'], ''),
          outcome: getStringValue(row, ['outcome', 'status', 'result'], 'recorded'),
        }))
        .sort((left, right) => parseDateMs(right.created_at) - parseDateMs(left.created_at))
        .slice(0, 12);
      const forecastRecommendations = forecastRows
        .map((row) => ({
          recommendation_id: getStringValue(row, ['id', 'recommendation_id'], 'forecast'),
          work_package_id: getStringValue(row, ['work_package_id', 'package_id'], 'unknown-work-package'),
          recommendation: getStringValue(row, ['recommendation', 'action', 'suggested_action'], 'Review intervention plan'),
          confidence_pct: Math.round(normalizePercent(getNumericValue(row, ['confidence_pct', 'confidence_score'], 0)) * 10) / 10,
          risk_score: Math.round(normalizePercent(getNumericValue(row, ['risk_score', 'risk_pct'], 0)) * 10) / 10,
          reason: getStringValue(row, ['reason', 'explainability', 'rationale'], 'Model-derived recommendation'),
        }))
        .sort((left, right) => right.risk_score - left.risk_score)
        .slice(0, 10);

      res.status(200).json({
        version: 'v2',
        interface: 'load-operational-trends',
        requestId,
        input: {
          metric_key: metricKey,
          window: normalizedWindow,
          compare_window: compareWindow,
        },
        output: {
          time_series: timeSeries,
          variance,
          threshold_breaches: variance > 8 ? [{ metric_key: metricKey, threshold: 8, observed: variance, level: 'warning' }] : [],
          task_execution_monitor: {
            technician_count: technicianIds.size,
            completed_tasks: completedCount,
            average_productivity_pct: productivityCount ? Math.round((normalizePercent(productivitySum / productivityCount)) * 10) / 10 : 0,
            mobile_completion_rate_pct: completedCount ? Math.round((normalizePercent((mobileCompletedCount / completedCount) * 100)) * 10) / 10 : 0,
          },
          scheduling_board_snapshot: {
            upcoming_slots: upcomingSlots,
            resource_utilization_pct: utilizationSamples.length
              ? Math.round((utilizationSamples.reduce((sum, item) => sum + item, 0) / utilizationSamples.length) * 10) / 10
              : 0,
          },
          certification_decision_queue: certificationQueue,
          audit_timeline: auditTimeline,
          forecast_recommendation_hub: forecastRecommendations,
          data_issues: dataIssues,
        },
      });
      return;
    }

    if (req.method === 'POST' && interfaceName === 'export-kpi-snapshot') {
      const payload = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      parseDateRange(payload.date_range);
      const selectedWidgets = parseStringArray(payload.selected_widgets);
      if (selectedWidgets.length === 0) {
        res.status(400).json({
          error: 'selected_widgets must include at least one widget',
          statusCode: 400,
          requestId,
          version: 'v2',
        });
        return;
      }
      const format = String(payload.format || '').trim().toLowerCase() === 'pdf' ? 'pdf' : 'csv';
      const generatedAt = new Date().toISOString();
      res.status(200).json({
        version: 'v2',
        interface: 'export-kpi-snapshot',
        requestId,
        output: {
          export_job_id: `${tenantId}-kpi-export-${Date.now()}`,
          download_url: `/api/v2/amro/overview-kpi/download/${tenantId}-${Date.now()}.${format}`,
          generated_at: generatedAt,
        },
      });
      return;
    }

    res.status(400).json({
      error: 'Unsupported interface. Use load-kpi-dashboard, load-operational-trends, or export-kpi-snapshot.',
      statusCode: 400,
      requestId,
      version: 'v2',
    });
  } catch (error) {
    logger.error('overview-kpi route error', {
      requestId,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unexpected error',
      statusCode: 500,
      requestId,
      version: 'v2',
    });
  }
});

// ============================================================================
// PROTECTED API ROUTES
// ============================================================================

// Apply authentication middleware to all API routes
app.use('/api/v1', authMiddleware);
app.use('/api/v2/amro', authMiddleware);

// Mount work orders routes
app.use('/api/v1', workOrdersRoutes);
app.use('/api/v2', workOrdersRoutes);
app.use('/api/v2', masterDataRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * 404 Handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    code: 'NOT_FOUND',
    statusCode: 404,
    path: req.path,
  } as ErrorResponse);
});

/**
 * Global Error Handler
 */
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  logger.error('Unhandled error', {
    requestId,
    method: req.method,
    path: req.path,
    message: err instanceof Error ? err.message : 'Unknown error',
    stack: err instanceof Error ? err.stack : undefined,
  });

  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred';

  res.status(statusCode).json({
    error: message,
    code,
    statusCode,
    requestId,
  } as ErrorResponse);
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

/**
 * Setup graceful shutdown to disconnect Kafka producer
 */
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await amroEventsProducer.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  await amroEventsProducer.shutdown();
  process.exit(0);
});

export default app;
