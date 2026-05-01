/**
 * Express Application Setup
 * Middleware and route initialization
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { authMiddleware, AuthRequest, getAuthHeaderMonitoringSnapshot } from './middleware/auth.middleware';
import masterDataRoutes from './routes/master-data.routes';
import workOrdersRoutes from './routes/work-orders.routes';
import workOrderTemplateRoutes from './routes/work-order-template.routes';
import partsRoutes from './routes/parts.routes';
import itemMasterRoutes from './routes/item-master.routes';
import mpdRoutes from './routes/mpd.routes';
import directivesRoutes from './routes/directives.routes';
import configureMpdRoutes from './routes/configure-mpd.routes';
import stockLedgerRoutes from './routes/stock-ledger.routes';
import enterpriseRoutes from './routes/enterprise.routes';
import { ErrorResponse } from './types/amro.types';
import { logger } from './utils/logger';
import { amroEventsProducer } from './events/amro-events.producer';
import { executeWithResilience, getResilienceStatus } from './utils/resilience';

const app: Express = express();
type JsonRecord = Record<string, unknown>;
type PilotLookupRow = {
  user_id: string;
  display_name: string;
  email: string;
};

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
  work_order_master: ['work_orders'],
  materials_inventory: ['parts_inventory', 'amro_work_order_materials', 'work_order_materials'],
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
    authorizationHeaderPresent: Boolean(String(req.headers.authorization || '').trim()),
    authorizationScheme: String(req.headers.authorization || '').trim().split(/\s+/)[0]?.toLowerCase() || null,
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
    authHeaderMonitoring: getAuthHeaderMonitoringSnapshot(),
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
    authHeaderMonitoring: getAuthHeaderMonitoringSnapshot(),
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
    authHeaderMonitoring: getAuthHeaderMonitoringSnapshot(),
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
      const [workOrderRows, materialsRows, complianceRows, integrationRows, forecastRows] = await Promise.all([
        fetchScopedRows('work_order_master', tenantId, 200, dataIssues),
        fetchScopedRows('materials_inventory', tenantId, 200, dataIssues),
        fetchScopedRows('compliance_gates', tenantId, 200, dataIssues),
        fetchScopedRows('integration_logs', tenantId, 200, dataIssues),
        fetchScopedRows('forecast_recommendations', tenantId, 200, dataIssues),
      ]);

      const filteredWorkOrders = workOrderRows.filter((row) => {
        const planner = getStringValue(row, ['planner_id', 'assigned_planner_id', 'assigned_to']);
        const engineer = getStringValue(row, ['engineer_id', 'assigned_engineer_id', 'lead_engineer_id']);
        const plannerPass = !plannerId || planner === plannerId;
        const engineerPass = !engineerId || engineer === engineerId;
        return plannerPass && engineerPass;
      });
      const now = Date.now();
      const activeWorkOrders = filteredWorkOrders.filter((row) => !isResolvedStatus(resolveStatus(row))).length;
      const overdueTasks = filteredWorkOrders.filter((row) => {
        const dueMs = parseDateMs(getStringValue(row, ['due_at', 'planned_end_at', 'target_end_at', 'planned_end', 'scheduled_end_at']));
        return Number.isFinite(dueMs) && dueMs < now && !isResolvedStatus(resolveStatus(row));
      }).length;
      const compliancePassed = complianceRows.filter((row) => ['passed', 'approved', 'resolved'].includes(resolveStatus(row))).length;
      const compliancePct = complianceRows.length ? (compliancePassed / complianceRows.length) * 100 : 0;
      const forecastRecommendations = forecastRows
        .map((row) => ({
          recommendation_id: getStringValue(row, ['id', 'recommendation_id'], 'forecast'),
          work_order_id: getStringValue(row, ['work_order_id', 'package_id'], 'unknown-work-order'),
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
      const workOrderOverview = filteredWorkOrders.slice(0, 15).map((row) => ({
        work_order_id: getStringValue(row, ['id', 'work_order_id', 'code', 'work_order_number', 'work_order_number'], 'unknown-work-order'),
        title: getStringValue(row, ['title', 'name', 'description', 'work_order_number', 'work_order_number'], 'Untitled work package'),
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
            active_work_orders: activeWorkOrders,
            overdue_tasks: overdueTasks,
            compliance_status_pct: Math.round(compliancePct * 10) / 10,
            forecast_accuracy_pct: Math.round(forecastAccuracy * 10) / 10,
          },
          kpi_cards: [
            { key: 'open_work_orders', label: 'Open Work Packages', value: activeWorkOrders, trend: activeWorkOrders > 0 ? '+2%' : '0%' },
            { key: 'overdue_tasks', label: 'Overdue Tasks', value: overdueTasks, trend: overdueTasks > 0 ? '+1%' : '0%' },
            { key: 'compliance_status_pct', label: 'Compliance Status %', value: Math.round(compliancePct * 10) / 10, trend: compliancePct >= 95 ? '+0.5%' : '-0.8%' },
            { key: 'forecast_accuracy_pct', label: 'Forecast Accuracy %', value: Math.round(forecastAccuracy * 10) / 10, trend: forecastAccuracy >= 90 ? '+1.2%' : '-0.4%' },
          ],
          risk_heatmap: {
            cells: complianceAttention.slice(0, 8).map((item, index) => ({
              station: workOrderOverview[index]?.planner_id || stationIds[index] || `${tenantId}:station-${index + 1}`,
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
          work_order_overview: workOrderOverview,
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
          work_order_id: getStringValue(row, ['work_order_id', 'package_id'], 'unknown-work-order'),
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
          work_order_id: getStringValue(row, ['work_order_id', 'package_id'], 'unknown-work-order'),
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

// GET /api/v2/amro/work-order-template-versions?template_id=uuid
app.get('/api/v2/amro/work-order-template-versions', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  const tenantId = String(req.tenantId || req.header('x-tenant-id') || '').trim();
  if (!tenantId) {
    res.status(400).json({ error: 'Missing tenant context', statusCode: 400, requestId, version: 'v2' });
    return;
  }

  try {
    const templateId = String(req.query.template_id || '').trim();
    if (!templateId) {
      res.status(400).json({ error: 'template_id is required', statusCode: 400, requestId, version: 'v2' });
      return;
    }

    const page = Math.max(1, Math.trunc(Number(req.query.page) || 1));
    const pageSize = Math.min(100, Math.max(1, Math.trunc(Number(req.query.page_size) || 20)));

    // Get Supabase client
    const supabase = getSupabaseAdminClient();

    // Query template versions from database
    const { data: versions, error, count } = await supabase
      .from('amro_work_order_template_versions')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('template_id', templateId)
      .order('version_number', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      // Table might not exist, return empty response
      logger.warn('Template versions table query failed', { error: error.message });
      res.status(200).json({
        version: 'v2',
        interface: 'list-template-versions',
        correlationId: requestId,
        output: {
          template_id: templateId,
          tenant_id: tenantId,
          versions: [],
          pagination: { page, page_size: pageSize, total: 0, total_pages: 0 },
        },
      });
      return;
    }

    res.status(200).json({
      version: 'v2',
      interface: 'list-template-versions',
      correlationId: requestId,
      output: {
        template_id: templateId,
        tenant_id: tenantId,
        versions: versions || [],
        pagination: {
          page,
          page_size: pageSize,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / pageSize),
        },
      },
    });
  } catch (error) {
    logger.error('work-order-template-versions route error', {
      requestId,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      tenantId,
      templateId: String(req.query.template_id || ''),
    });
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unexpected error',
      statusCode: 500,
      requestId,
      version: 'v2',
    });
  }
});

// POST /api/v2/amro/work-order-template-versions
app.post('/api/v2/amro/work-order-template-versions', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  const tenantId = String(req.tenantId || req.header('x-tenant-id') || '').trim();
  const userId = String(req.userId || req.header('x-user-id') || '').trim();
  const franchiseId = String(req.header('x-franchise-id') || '').trim() || null;

  if (!tenantId || !userId) {
    res.status(401).json({ error: 'Missing tenant or user context', statusCode: 401, requestId, version: 'v2' });
    return;
  }

  try {
    const {
      template_id,
      change_description,
      change_reason,
      version_label,
      tasks_json = [],
      materials_json = [],
      tooling_json = [],
      compliance_requirements_json = [],
      estimated_labor_hours = null,
    } = req.body || {};

    if (!template_id) {
      res.status(400).json({ error: 'template_id is required', statusCode: 400, requestId, version: 'v2' });
      return;
    }
    if (!change_description) {
      res.status(400).json({ error: 'change_description is required', statusCode: 400, requestId, version: 'v2' });
      return;
    }

    const supabase = getSupabaseAdminClient();

    // Verify template exists
    const { data: template, error: templateError } = await supabase
      .from('work_order_templates')
      .select('id, tenant_id, franchise_id')
      .eq('id', template_id)
      .eq('tenant_id', tenantId)
      .single();

    if (templateError || !template) {
      res.status(404).json({ error: 'Template not found', statusCode: 404, requestId, version: 'v2' });
      return;
    }

    // Get next version number
    const { data: maxVersion } = await supabase
      .from('amro_work_order_template_versions')
      .select('version_number')
      .eq('template_id', template_id)
      .eq('tenant_id', tenantId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = maxVersion ? maxVersion.version_number + 1 : 1;

    const versionData = {
      tenant_id: tenantId,
      franchise_id: franchiseId || template.franchise_id,
      template_id,
      version_number: nextVersion,
      version_label: version_label || null,
      change_description,
      change_reason: change_reason || change_description,
      status: 'draft',
      submitted_by: null,
      submitted_at: null,
      reviewed_by: null,
      reviewed_at: null,
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
      tasks_json,
      materials_json,
      tooling_json,
      compliance_requirements_json,
      effective_from: null,
      effective_until: null,
      aircraft_models: [],
      engine_models: [],
      created_by: userId,
      updated_by: userId,
    };

    const { data: created, error: createError } = await supabase
      .from('amro_work_order_template_versions')
      .insert(versionData)
      .select()
      .single();

    console.log("[WPT VERSION CREATE] Attempting to insert:", JSON.stringify(versionData, null, 2));
    if (createError) {
      logger.error('Version creation failed', { error: createError.message, requestId });
      res.status(400).json({ error: createError.message, statusCode: 400, requestId, version: 'v2' });
      return;
    }

    res.status(201).json({ version: 'v2', correlationId: requestId, output: created });
  } catch (error) {
    logger.error('work-order-template-version creation error', {
      requestId,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({ error: 'Failed to create version', statusCode: 500, requestId, version: 'v2' });
  }
});

// PUT /api/v2/amro/work-order-template-versions/:id
app.put('/api/v2/amro/work-order-template-versions/:id', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  const tenantId = String(req.tenantId || req.header('x-tenant-id') || '').trim();
  const userId = String(req.userId || req.header('x-user-id') || '').trim();
  const { id } = req.params;

  if (!tenantId || !userId) {
    res.status(401).json({ error: 'Missing context', statusCode: 401, requestId, version: 'v2' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();

    const { data: existing, error: fetchError } = await supabase
      .from('amro_work_order_template_versions')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !existing) {
      res.status(404).json({ error: 'Version not found', statusCode: 404, requestId, version: 'v2' });
      return;
    }

    if (existing.status !== 'draft') {
      res.status(400).json({ error: 'Only draft versions can be updated', statusCode: 400, requestId, version: 'v2' });
      return;
    }

    const allowedFields = ['version_label', 'change_description', 'change_reason', 'tasks_json', 'materials_json', 'tooling_json', 'compliance_requirements_json'];
    const updateData: Record<string, any> = { updated_by: userId };
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    const { data: updated, error: updateError } = await supabase
      .from('amro_work_order_template_versions')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError) {
      res.status(400).json({ error: updateError.message, statusCode: 400, requestId, version: 'v2' });
      return;
    }

    res.json({ version: 'v2', correlationId: requestId, output: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update version', statusCode: 500, requestId, version: 'v2' });
  }
});

// POST /api/v2/amro/work-order-template-versions/:id/submit
app.post('/api/v2/amro/work-order-template-versions/:id/submit', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  const tenantId = String(req.tenantId || req.header('x-tenant-id') || '').trim();
  const userId = String(req.userId || req.header('x-user-id') || '').trim();
  const { id } = req.params;

  if (!tenantId || !userId) {
    res.status(401).json({ error: 'Missing context', statusCode: 401, requestId, version: 'v2' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();

    const { data: existing } = await supabase.from('amro_work_order_template_versions').select('*').eq('id', id).eq('tenant_id', tenantId).single();
    if (!existing) {
      res.status(404).json({ error: 'Version not found', statusCode: 404, requestId, version: 'v2' });
      return;
    }
    if (existing.status !== 'draft') {
      res.status(400).json({ error: 'Only draft versions can be submitted', statusCode: 400, requestId, version: 'v2' });
      return;
    }

    const { data: updated } = await supabase.from('amro_work_order_template_versions').update({ status: 'pending_review', submitted_by: userId, submitted_at: new Date().toISOString(), updated_by: userId }).eq('id', id).eq('tenant_id', tenantId).select().single();

    res.json({ version: 'v2', correlationId: requestId, output: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit', statusCode: 500, requestId, version: 'v2' });
  }
});

// POST /api/v2/amro/work-order-template-versions/:id/approve
app.post('/api/v2/amro/work-order-template-versions/:id/approve', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  const tenantId = String(req.tenantId || req.header('x-tenant-id') || '').trim();
  const userId = String(req.userId || req.header('x-user-id') || '').trim();
  const { id } = req.params;
  const { action, rejection_reason, set_active = false } = req.body || {};

  if (!tenantId || !userId) {
    res.status(401).json({ error: 'Missing context', statusCode: 401, requestId, version: 'v2' });
    return;
  }
  if (!['approve', 'reject'].includes(action)) {
    res.status(400).json({ error: 'action must be "approve" or "reject"', statusCode: 400, requestId, version: 'v2' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();

    const { data: existing } = await supabase.from('amro_work_order_template_versions').select('*').eq('id', id).eq('tenant_id', tenantId).single();
    if (!existing) {
      res.status(404).json({ error: 'Version not found', statusCode: 404, requestId, version: 'v2' });
      return;
    }
    if (existing.status !== 'pending_review') {
      res.status(400).json({ error: 'Only pending versions can be reviewed', statusCode: 400, requestId, version: 'v2' });
      return;
    }
    if (action === 'reject' && !rejection_reason) {
      res.status(400).json({ error: 'rejection_reason is required', statusCode: 400, requestId, version: 'v2' });
      return;
    }

    const updateData: Record<string, any> = { status: action === 'approve' ? 'approved' : 'rejected', reviewed_by: userId, reviewed_at: new Date().toISOString(), rejection_reason: action === 'reject' ? rejection_reason : null, updated_by: userId };
    if (action === 'approve' && set_active) {
      updateData.status = 'active';
      updateData.approved_by = userId;
      updateData.approved_at = new Date().toISOString();
    }

    const { data: updated } = await supabase.from('amro_work_order_template_versions').update(updateData).eq('id', id).eq('tenant_id', tenantId).select().single();
    res.json({ version: 'v2', correlationId: requestId, output: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to review', statusCode: 500, requestId, version: 'v2' });
  }
});

// DELETE /api/v2/amro/work-order-template-versions/:id
app.delete('/api/v2/amro/work-order-template-versions/:id', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  const tenantId = String(req.tenantId || req.header('x-tenant-id') || '').trim();
  const { id } = req.params;

  if (!tenantId) {
    res.status(401).json({ error: 'Missing context', statusCode: 401, requestId, version: 'v2' });
    return;
  }

  try {
    const supabase = getSupabaseAdminClient();

    const { data: existing } = await supabase.from('amro_work_order_template_versions').select('id, status').eq('id', id).eq('tenant_id', tenantId).single();
    if (!existing) {
      res.status(404).json({ error: 'Version not found', statusCode: 404, requestId, version: 'v2' });
      return;
    }
    if (existing.status !== 'draft') {
      res.status(400).json({ error: 'Only draft versions can be deleted', statusCode: 400, requestId, version: 'v2' });
      return;
    }

    await supabase.from('amro_work_order_template_versions').delete().eq('id', id).eq('tenant_id', tenantId);
    res.json({ version: 'v2', correlationId: requestId, output: { deleted: true, id } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete', statusCode: 500, requestId, version: 'v2' });
  }
});

app.get('/api/v2/amro/aircraft-dashboard', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  const tenantId = String(req.tenantId || req.header('x-tenant-id') || '').trim();
  if (!tenantId) {
    res.status(400).json({
      error: 'Missing tenant context',
      statusCode: 400,
      requestId,
      version: 'v2',
    });
    return;
  }

  const normalizeModule = (value: unknown): 'overview' | 'engine' | 'components' | 'all' => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'engine') return 'engine';
    if (normalized === 'components') return 'components';
    if (normalized === 'all') return 'all';
    return 'overview';
  };

  const parsePositiveInteger = (value: unknown, fallbackValue: number, minValue: number, maxValue: number): number => {
    const parsed = Math.trunc(Number(value));
    if (!Number.isFinite(parsed)) {
      return fallbackValue;
    }
    return Math.min(maxValue, Math.max(minValue, parsed));
  };

  const computeDueInDays = (value: unknown): number | null => {
    const dueMs = parseDateMs(value);
    if (!Number.isFinite(dueMs)) return null;
    return Math.round((dueMs - Date.now()) / (24 * 60 * 60 * 1000));
  };

  const isWithinDueWindow = (value: unknown, dueWithinDays: number): boolean => {
    if (dueWithinDays <= 0) return true;
    const dueInDays = computeDueInDays(value);
    if (dueInDays === null) return true;
    return dueInDays <= dueWithinDays;
  };

  try {
    const moduleSelection = normalizeModule(req.query.module);
    const aircraftFilter = String(req.query.aircraft_id || '').trim().toLowerCase();
    const statusFilter = String(req.query.status || 'all').trim().toLowerCase();
    const dueWithinDays = parsePositiveInteger(req.query.due_within_days, 30, 0, 365);
    const trendDays = parsePositiveInteger(req.query.trend_days, 14, 7, 90);
    const rowLimit = parsePositiveInteger(req.query.limit, 120, 10, 250);
    const dataIssues: string[] = [];

    const [aircraftRows, workOrderRowsRaw, flightLogRowsRaw, maintenanceEventRows, materialsRows] = await Promise.all([
      fetchScopedRows('aircraft', tenantId, rowLimit, dataIssues),
      fetchScopedRows('work_order_master', tenantId, rowLimit, dataIssues),
      fetchScopedRows('flight_logs', tenantId, rowLimit, dataIssues),
      fetchScopedRows('maintenance_events', tenantId, rowLimit, dataIssues),
      fetchScopedRows('materials_inventory', tenantId, rowLimit, dataIssues),
    ]);

    const filteredAircraftRows = aircraftRows.filter((row) => {
      if (!aircraftFilter) return true;
      const id = getStringValue(row, ['id']).toLowerCase();
      const registration = getStringValue(row, ['registration', 'tail_number']).toLowerCase();
      return id.includes(aircraftFilter) || registration.includes(aircraftFilter);
    });

    const filteredFlightLogRows = flightLogRowsRaw.filter((row) => {
      if (!aircraftFilter) return true;
      return getStringValue(row, ['aircraft_id']).toLowerCase().includes(aircraftFilter);
    });

    const filteredWorkOrderRows = workOrderRowsRaw.filter((row) => {
      if (aircraftFilter && !getStringValue(row, ['aircraft_id']).toLowerCase().includes(aircraftFilter)) {
        return false;
      }
      const status = resolveStatus(row);
      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }
      const dueSource = row.due_at || row.planned_end || row.planned_start;
      return isWithinDueWindow(dueSource, dueWithinDays);
    });

    const mappedMaintenanceSchedule = filteredWorkOrderRows.map((row) => {
      const dueDate = getStringValue(row, ['due_at', 'planned_end', 'planned_start']);
      const status = resolveStatus(row) || 'open';
      return {
        work_order_id: getStringValue(row, ['id']),
        aircraft_id: getStringValue(row, ['aircraft_id']),
        work_order_number: getStringValue(row, ['work_order_number', 'work_order_number', 'id']),
        title: getStringValue(row, ['title', 'work_order_number', 'work_order_number'], 'Maintenance package'),
        status,
        priority: getStringValue(row, ['priority'], 'medium'),
        due_at: dueDate,
        due_in_days: computeDueInDays(dueDate),
        updated_at: getStringValue(row, ['updated_at', 'created_at']),
      };
    });

    const mappedDefectRows = maintenanceEventRows
      .filter((row) => {
        const eventType = getStringValue(row, ['event_type', 'category']).toLowerCase();
        if (eventType && !eventType.includes('defect') && !eventType.includes('discrepancy')) {
          return false;
        }
        if (!aircraftFilter) return true;
        return getStringValue(row, ['aircraft_id']).toLowerCase().includes(aircraftFilter);
      })
      .map((row) => {
        const dueDate = getStringValue(row, ['due_at', 'target_date', 'updated_at']);
        return {
          id: getStringValue(row, ['id']),
          title: getStringValue(row, ['title', 'description', 'event_type'], 'Defect'),
          severity: getStringValue(row, ['severity', 'priority'], 'medium'),
          status: getStringValue(row, ['status', 'resolution_status'], 'open'),
          due_in_days: computeDueInDays(dueDate),
          reported_at: getStringValue(row, ['created_at', 'updated_at']),
          updated_at: getStringValue(row, ['updated_at', 'created_at']),
        };
      });

    const mappedFlightLogs = filteredFlightLogRows.map((row) => ({
      id: getStringValue(row, ['id']),
      aircraft_id: getStringValue(row, ['aircraft_id']),
      flight_date: getStringValue(row, ['flight_date']),
      flight_number: getStringValue(row, ['flight_number', 'id']),
      route: `${getStringValue(row, ['departure_airport'], 'N/A')}-${getStringValue(row, ['arrival_airport'], 'N/A')}`,
      pilot_name: getStringValue(row, ['pilot_name'], 'Unassigned'),
      flight_hours: Number(getNumericValue(row, ['flight_hours'], 0).toFixed(2)),
      flight_cycles: Math.round(getNumericValue(row, ['flight_cycles'], 0)),
      regulatory_authority: getStringValue(row, ['regulatory_authority'], 'N/A'),
      updated_at: getStringValue(row, ['updated_at', 'created_at']),
    }));

    const nowMs = Date.now();
    const openWorkOrders = filteredWorkOrderRows.filter((row) => !isResolvedStatus(resolveStatus(row))).length;
    const overdueWorkOrders = filteredWorkOrderRows.filter((row) => {
      const status = resolveStatus(row);
      if (isResolvedStatus(status)) return false;
      const dueMs = parseDateMs(row.due_at || row.planned_end || row.planned_start);
      return Number.isFinite(dueMs) && dueMs < nowMs;
    }).length;
    const dueWithinWindow = filteredWorkOrderRows.filter((row) => {
      const dueMs = parseDateMs(row.due_at || row.planned_end || row.planned_start);
      if (!Number.isFinite(dueMs)) return false;
      const diffDays = Math.round((dueMs - nowMs) / (24 * 60 * 60 * 1000));
      return diffDays >= 0 && diffDays <= dueWithinDays;
    }).length;

    const totalFlightHours = Number(
      mappedFlightLogs.reduce((sum, row) => sum + Number(row.flight_hours || 0), 0).toFixed(2),
    );
    const totalCycles = Math.round(mappedFlightLogs.reduce((sum, row) => sum + Number(row.flight_cycles || 0), 0));
    const complianceReadyPct = normalizePercent(
      filteredWorkOrderRows.length === 0
        ? 1
        : (filteredWorkOrderRows.length - overdueWorkOrders) / filteredWorkOrderRows.length,
    );

    const flightHoursTrend = buildTrendSeries(filteredFlightLogRows, trendDays <= 7 ? '7d' : trendDays >= 90 ? '90d' : '30d')
      .map((point) => ({
        day: point.date,
        value: point.value,
      }));
    const defectTrend = buildTrendSeries(maintenanceEventRows, trendDays <= 7 ? '7d' : trendDays >= 90 ? '90d' : '30d')
      .map((point) => ({
        day: point.date,
        value: point.value,
      }));

    const workOrderTotals = {
      open: filteredWorkOrderRows.filter((row) => resolveStatus(row) === 'open').length,
      in_progress: filteredWorkOrderRows.filter((row) => resolveStatus(row) === 'in_progress').length,
      blocked: filteredWorkOrderRows.filter((row) => resolveStatus(row) === 'blocked').length,
      completed: filteredWorkOrderRows.filter((row) => isResolvedStatus(resolveStatus(row))).length,
    };

    const engineAlerts = [
      ...(overdueWorkOrders > 0
        ? [
            {
              module: 'engine',
              code: 'ENGINE_OVERDUE_WORK_PACKAGES',
              severity: 'warning',
              message: `${overdueWorkOrders} engine work packages are overdue`,
            },
          ]
        : []),
      ...(mappedDefectRows.filter((row) => String(row.severity).toLowerCase() === 'critical').length > 0
        ? [
            {
              module: 'engine',
              code: 'ENGINE_CRITICAL_DEFECTS',
              severity: 'critical',
              message: 'Critical engine defects require immediate action',
            },
          ]
        : []),
    ];

    const componentsAlerts = [
      ...(materialsRows.length === 0
        ? [
            {
              module: 'components',
              code: 'COMPONENT_INVENTORY_EMPTY',
              severity: 'warning',
              message: 'No component inventory rows found for current tenant scope',
            },
          ]
        : []),
    ];

    // Enrich aircraft model name using assembly_models lookup when aircraft row model is missing.
    const assemblyModelIds = Array.from(
      new Set(
        filteredAircraftRows
          .map((row) => getStringValue(row, ['assembly_models', 'assemblymodels']))
          .filter((id) => id.length > 0),
      ),
    );
    let assemblyModelNameById = new Map<string, string>();
    if (assemblyModelIds.length > 0) {
      try {
        const adminClient = getSupabaseAdminClient();
        const { data: assemblyRows, error: assemblyError } = await adminClient
          .from('assembly_models')
          .select('id,name')
          .in('id', assemblyModelIds);
        if (assemblyError) {
          logger.warn('[AMRO Aircraft Dashboard] assembly model enrichment lookup failed', {
            requestId,
            message: String(assemblyError.message || ''),
            requestedCount: assemblyModelIds.length,
          });
        } else {
          assemblyModelNameById = new Map(
            (Array.isArray(assemblyRows) ? assemblyRows : [])
              .map((row) => [
                String((row as Record<string, unknown>).id || '').trim(),
                String((row as Record<string, unknown>).name || '').trim(),
              ] as const)
              .filter(([id, name]) => id.length > 0 && name.length > 0),
          );
          logger.info('[AMRO Aircraft Dashboard] assembly model enrichment resolved', {
            requestId,
            requestedCount: assemblyModelIds.length,
            resolvedCount: assemblyModelNameById.size,
          });
        }
      } catch (error) {
        logger.warn('[AMRO Aircraft Dashboard] assembly model enrichment exception', {
          requestId,
          message: String((error as Error)?.message || error),
        });
      }
    }

    const output = {
      metadata: {
        role_view: String((req.user as { role?: unknown } | undefined)?.role || 'technician'),
        cache: 'miss',
        generated_at: new Date().toISOString(),
      },
      kpis: {
        fleet_size: filteredAircraftRows.length,
        open_work_orders: openWorkOrders,
        due_within_window: dueWithinWindow,
        overdue_work_orders: overdueWorkOrders,
        open_defects: mappedDefectRows.length,
        total_flight_hours: totalFlightHours,
        total_cycles: totalCycles,
        compliance_ready_pct: Number(complianceReadyPct.toFixed(2)),
      },
      aircraft_status: filteredAircraftRows.slice(0, 12).map((row) => ({
        ...((): Record<string, unknown> => {
          const assemblyModelId = getStringValue(row, ['assembly_models', 'assemblymodels']);
          const directModelName = getStringValue(row, ['aircraft_model', 'model', 'model_name']);
          const enrichedModelName = assemblyModelId ? (assemblyModelNameById.get(assemblyModelId) || '') : '';
          const resolvedAircraftModel = directModelName || enrichedModelName || null;
          if (!resolvedAircraftModel && assemblyModelId) {
            logger.warn('[AMRO Aircraft Dashboard] aircraft model unresolved for assembly model id', {
              requestId,
              aircraftId: getStringValue(row, ['id']),
              assemblyModelId,
            });
          }
          return {
            aircraft_model: resolvedAircraftModel,
          };
        })(),
        aircraft_id: getStringValue(row, ['id']),
        registration: getStringValue(row, ['registration', 'tail_number']),
        serial_number: getStringValue(row, ['serial_number', 'msn']) || null,
        status: getStringValue(row, ['status'], 'unknown'),
        current_flight_hours: getNumericValue(row, ['current_flight_hours'], 0),
        current_cycles: getNumericValue(row, ['current_cycles'], 0),
        assembly_models: getStringValue(row, ['assembly_models', 'assemblymodels']) || null,
      })),
      maintenance_schedule: mappedMaintenanceSchedule.slice(0, 20),
      flight_logs: mappedFlightLogs.slice(0, 20),
      defect_tracking: mappedDefectRows.slice(0, 20),
      compliance_status: {
        ready_count: Math.max(0, filteredWorkOrderRows.length - overdueWorkOrders),
        pending_count: openWorkOrders,
        overdue_count: overdueWorkOrders,
        compliance_pct: Number(complianceReadyPct.toFixed(2)),
      },
      performance_metrics: {
        flight_hours_trend: flightHoursTrend,
        defect_trend: defectTrend,
        signal_severity_index: Math.min(100, Math.max(0, mappedDefectRows.length * 8 + overdueWorkOrders * 12)),
      },
      alerts: [...engineAlerts, ...componentsAlerts],
      engine_module: moduleSelection === 'engine' || moduleSelection === 'all'
        ? {
            kpis: {
              monitored_engines: Math.max(1, filteredAircraftRows.length),
              tbo_remaining_hours: Math.max(0, 4200 - totalFlightHours),
              llp_avg_remaining_cycles: Math.max(0, 3000 - totalCycles),
              oil_consumption_lph: Number((0.2 + mappedDefectRows.length * 0.01).toFixed(3)),
              vibration_ips: Number((0.18 + overdueWorkOrders * 0.02).toFixed(3)),
              total_engine_hours: totalFlightHours,
              total_engine_cycles: totalCycles,
            },
            statuses: {
              tbo: overdueWorkOrders > 0 ? 'warning' : 'normal',
              llp: mappedDefectRows.length > 4 ? 'warning' : 'normal',
              oil_consumption: mappedDefectRows.length > 6 ? 'warning' : 'normal',
              vibration: overdueWorkOrders > 2 ? 'critical' : 'normal',
            },
            trend: flightHoursTrend,
            lifecycle_management: mappedMaintenanceSchedule.slice(0, 8),
            maintenance_schedule: mappedMaintenanceSchedule.slice(0, 10),
            maintenance_planning: {
              predictive_candidates: mappedDefectRows.slice(0, 4),
              scheduled_windows: mappedMaintenanceSchedule.slice(0, 4),
              conflicts: mappedMaintenanceSchedule.filter((row) => Number(row.due_in_days ?? 9999) < 0).slice(0, 4),
              resolution_actions: [],
              resource_allocation: mappedMaintenanceSchedule.slice(0, 4).map((row, index) => ({
                slot: `SLOT-${index + 1}`,
                work_order_number: row.work_order_number,
                status: row.status,
              })),
            },
            lifecycle_traceability: mappedMaintenanceSchedule.slice(0, 8),
            component_monitoring: {
              statuses: {
                oil: mappedDefectRows.length > 5 ? 'warning' : 'normal',
                vibration: overdueWorkOrders > 1 ? 'warning' : 'normal',
                egt_margin: openWorkOrders > 10 ? 'warning' : 'normal',
              },
              realtime_updated_at: new Date().toISOString(),
              source: 'amro-api',
              sensor_data: [],
              anomaly_detection: {
                anomalies: mappedDefectRows.slice(0, 4),
              },
            },
            work_orders: {
              totals: workOrderTotals,
              recent: mappedMaintenanceSchedule.slice(0, 8),
              digital_signature_workflow: {
                total_required: filteredWorkOrderRows.length,
                completed: workOrderTotals.completed,
                pending: Math.max(0, filteredWorkOrderRows.length - workOrderTotals.completed),
              },
              parts_tracking: materialsRows.slice(0, 4).map((row) => ({
                part_number: getStringValue(row, ['part_number']),
                serial_number: getStringValue(row, ['serial_number']),
                quantity_available: getNumericValue(row, ['quantity_available', 'quantity_on_hand'], 0),
                status: getStringValue(row, ['status'], 'active'),
              })),
            },
            compliance_tracking: {
              ready_count: Math.max(0, filteredWorkOrderRows.length - overdueWorkOrders),
              pending_count: openWorkOrders,
              overdue_count: overdueWorkOrders,
              compliance_pct: Number(complianceReadyPct.toFixed(2)),
              ad_sb_tracking: {
                pending_actions: mappedDefectRows.length,
              },
              regulatory_profiles: {
                primary: 'ICAO',
                secondary: 'FAA',
              },
              standards: ['ICAO', 'EASA', 'FAA'],
            },
            performance_analytics: {
              utilization_pct: Number(Math.min(100, Math.max(0, openWorkOrders * 4.5)).toFixed(2)),
              anomaly_index: Math.min(100, mappedDefectRows.length * 10),
              forecast_risk: overdueWorkOrders > 0 ? 'elevated' : 'stable',
              trend_summary: flightHoursTrend.slice(-6),
              failure_prediction: {
                risk_band: overdueWorkOrders > 2 ? 'high' : overdueWorkOrders > 0 ? 'medium' : 'low',
                confidence: Number((0.66 + Math.min(0.29, mappedDefectRows.length * 0.02)).toFixed(2)),
              },
            },
            integration_capabilities: [
              { channel: 'maintenance-events', state: 'connected' },
              { channel: 'work-orders', state: 'connected' },
            ],
            integration_resilience: {
              retries: 0,
              circuit_open_skips: 0,
              data_issues: dataIssues,
            },
            validation: {
              data_issues: dataIssues,
            },
            drilldown: {
              defect_drivers: mappedDefectRows.slice(0, 8),
            },
            alerts: engineAlerts,
          }
        : null,
      components_module: moduleSelection === 'components' || moduleSelection === 'all'
        ? {
            kpis: {
              tracked_components: materialsRows.length,
              ad_sb_compliance_pct: Number(complianceReadyPct.toFixed(2)),
              ad_sb_pending_count: mappedDefectRows.length,
              mtbur_hours: Number((totalFlightHours / Math.max(1, mappedDefectRows.length || 1)).toFixed(2)),
              repeat_discrepancy_rate: Number((mappedDefectRows.length > 0 ? Math.min(100, mappedDefectRows.length * 6.5) : 0).toFixed(2)),
            },
            statuses: {
              inventory: materialsRows.length > 0 ? 'normal' : 'warning',
              compliance: overdueWorkOrders > 0 ? 'warning' : 'normal',
            },
            lifecycle_tracking: mappedMaintenanceSchedule.slice(0, 10),
            replacement_history: materialsRows.slice(0, 10).map((row) => ({
              part_number: getStringValue(row, ['part_number']),
              serial_number: getStringValue(row, ['serial_number']),
              status: getStringValue(row, ['status'], 'active'),
              reported_at: getStringValue(row, ['updated_at', 'created_at']),
              compliance_state: getStringValue(row, ['status'], 'compliant'),
            })),
            trend: defectTrend,
            drilldown: {
              open_defects: mappedDefectRows.filter((row) => String(row.status).toLowerCase() !== 'closed').slice(0, 8),
            },
            alerts: componentsAlerts,
          }
        : null,
    };

    res.status(200).json({
      version: 'v2',
      interface: 'load-aircraft-lead-dashboard',
      requestId,
      output,
    });
  } catch (error) {
    logger.error('aircraft-dashboard route error', {
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

app.get('/api/v2/amro/pilot-users', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const requestId = String(req.header('x-request-id') || crypto.randomUUID());
  const tenantId = String(req.tenantId || req.header('x-tenant-id') || '').trim();

  if (!tenantId) {
    return res.status(400).json({
      error: 'Tenant context is required',
      statusCode: 400,
      requestId,
      version: 'v2',
    });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data: customRoleRows, error: customRoleError } = await supabase
      .from('custom_roles')
      .select('id, tenant_id, name, is_active')
      .eq('tenant_id', tenantId)
      .ilike('name', 'pilot');
    if (customRoleError) {
      throw new Error(customRoleError.message || 'Failed to load custom pilot roles');
    }

    const pilotRoleIds = (customRoleRows || [])
      .filter((row) => String((row as Record<string, unknown>).tenant_id || '').trim() === tenantId)
      .filter((row) => (row as Record<string, unknown>).is_active !== false)
      .filter((row) => String((row as Record<string, unknown>).name || '').trim().toLowerCase() === 'pilot')
      .map((row) => String((row as Record<string, unknown>).id || '').trim())
      .filter(Boolean);

    if (!pilotRoleIds.length) {
      return res.status(200).json({
        version: 'v2',
        requestId,
        output: { records: [] as PilotLookupRow[] },
      });
    }

    const { data: assignmentRows, error: assignmentError } = await supabase
      .from('user_custom_roles')
      .select('user_id, role_id, tenant_id')
      .eq('tenant_id', tenantId)
      .in('role_id', pilotRoleIds);
    if (assignmentError) {
      throw new Error(assignmentError.message || 'Failed to load pilot role assignments');
    }

    const pilotUserIds = Array.from(
      new Set(
        (assignmentRows || [])
          .filter((row) => String((row as Record<string, unknown>).tenant_id || '').trim() === tenantId)
          .map((row) => String((row as Record<string, unknown>).user_id || '').trim())
          .filter(Boolean),
      ),
    );
    if (!pilotUserIds.length) {
      return res.status(200).json({
        version: 'v2',
        requestId,
        output: { records: [] as PilotLookupRow[] },
      });
    }

    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, is_active')
      .in('id', pilotUserIds);
    if (profileError) {
      throw new Error(profileError.message || 'Failed to load pilot user profiles');
    }

    const pilotRecords: PilotLookupRow[] = (profileRows || [])
      .filter((row) => (row as Record<string, unknown>).is_active !== false)
      .map((row) => {
        const record = row as Record<string, unknown>;
        const firstName = String(record.first_name || '').trim();
        const lastName = String(record.last_name || '').trim();
        const email = String(record.email || '').trim();
        return {
          user_id: String(record.id || '').trim(),
          display_name: `${firstName} ${lastName}`.trim() || email,
          email,
        };
      })
      .filter((row) => Boolean(row.user_id) && Boolean(row.display_name))
      .sort((left, right) => left.display_name.localeCompare(right.display_name, undefined, { sensitivity: 'base' }));

    return res.status(200).json({
      version: 'v2',
      requestId,
      output: {
        records: pilotRecords,
      },
    });
  } catch (error) {
    logger.error('pilot-users route error', {
      requestId,
      tenantId,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({
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
app.use('/api/v2', workOrderTemplateRoutes);
app.use('/api/v2/amro', workOrderTemplateRoutes); // Alias for /api/v2/amro/* path prefix
app.use('/api/v2', workOrdersRoutes);
app.use('/api/v2', masterDataRoutes);
app.use('/api/v2', partsRoutes);
app.use('/api/v2', itemMasterRoutes);
app.use('/api/v2', mpdRoutes);
app.use('/api/v2', directivesRoutes);
app.use('/api/v2', configureMpdRoutes);
app.use('/api/v2', stockLedgerRoutes);

// Mount enterprise routes
app.use('/api/v2/amro/enterprise', enterpriseRoutes);

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
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
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
  if (res.headersSent) {
    return next(err);
  }

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
