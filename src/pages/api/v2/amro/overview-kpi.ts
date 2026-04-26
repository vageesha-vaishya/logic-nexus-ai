import type { ApiRequest, ApiResponse } from '../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  logApiEvent,
  resolveAndApplyAccessContext,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';
import { buildAmroServiceBoundaryEnvelope, createAmroIsolationScope } from './anti-corruption-adapter';
import { enforceAmroSequentialMilestoneForOverviewKpiInterface } from './phase-plan-model';

type KpiWindow = '7d' | '30d' | '90d';
type JsonRecord = Record<string, unknown>;
type OverviewPersona = 'management' | 'planner';

const ALLOWED_METRIC_KEYS = new Set([
  'open_work_packages',
  'schedule_adherence',
  'aog_count',
  'compliance_risk',
  'parts_fill_rate',
]);
const ALLOWED_WINDOWS = new Set<KpiWindow>(['7d', '30d', '90d']);
const ALLOWED_EXPORT_FORMATS = new Set(['csv', 'pdf', 'xlsx']);
const ALLOWED_WIDGETS = new Set(['kpi_cards', 'risk_heatmap', 'trend_lines', 'anomaly_flags']);
const KPI_CACHE_STALE_THRESHOLD_SECONDS = Number(process.env.AMRO_KPI_CACHE_STALE_SECONDS || 900);
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 200;
const TABLE_FALLBACK_CANDIDATES: Record<string, string[]> = {
  work_package_master: ['work_orders'],
  materials_inventory: ['parts_inventory', 'amro_work_order_materials', 'work_package_materials'],
  compliance_gates: ['compliance_records', 'compliance_obligations'],
  integration_logs: ['integration_jobs', 'webhook_outbox'],
  forecast_recommendations: ['forecast_outputs', 'forecast_decisions'],
  task_execution_status: ['tasks'],
  scheduling_board_data: ['schedules'],
  certification_records: ['certification_actions'],
  audit_trails: ['maintenance_events'],
};
type ExportJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';
type StorageTier = 'hot' | 'warm' | 'cold';
type DependencyName = 'analytics_worker' | 'object_storage' | 'signed_download';
type DependencyState = 'healthy' | 'degraded' | 'down';
type CacheInvalidationReason = 'source_update' | 'stale_threshold' | 'manual_refresh';

type ExportJobRecord = {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  status: ExportJobStatus;
  progress_pct: number;
  created_at: string;
  started_at: string;
  completed_at: string | null;
  payload: Record<string, unknown>;
  response_payload: Record<string, unknown>;
  dependency_failures: Record<string, string>;
};

type ExportArtifactRecord = {
  key: string;
  tier: StorageTier;
  retention_days: number;
  created_at: string;
  expires_at: string;
  size_bytes: number;
  state: 'active' | 'expired' | 'purged';
};

type CircuitState = {
  failures: number;
  state: 'closed' | 'open';
  opened_at: number | null;
  last_error: string | null;
};

type CacheState = {
  cache_hits: number;
  cache_misses: number;
  last_source_change_ms: number;
  last_refreshed_at: string | null;
  last_invalidated_at: string | null;
};

const ALLOWED_RETENTION_DAYS = new Set([30, 60, 90]);
const ALLOWED_STORAGE_TIERS = new Set<StorageTier>(['hot', 'warm', 'cold']);
const MEMORY_EXPORT_JOBS = new Map<string, ExportJobRecord>();
const MEMORY_CACHE_STATE = new Map<string, CacheState>();
const MEMORY_CACHE_AUDIT = new Array<{
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  reason: CacheInvalidationReason;
  event_at: string;
  details: Record<string, unknown>;
}>();
const DEPENDENCY_CIRCUITS = new Map<DependencyName, CircuitState>([
  ['analytics_worker', { failures: 0, state: 'closed', opened_at: null, last_error: null }],
  ['object_storage', { failures: 0, state: 'closed', opened_at: null, last_error: null }],
  ['signed_download', { failures: 0, state: 'closed', opened_at: null, last_error: null }],
]);
const DEPENDENCY_HEALTH = new Map<DependencyName, { last_success_at: string | null; last_failure_at: string | null }>([
  ['analytics_worker', { last_success_at: null, last_failure_at: null }],
  ['object_storage', { last_success_at: null, last_failure_at: null }],
  ['signed_download', { last_success_at: null, last_failure_at: null }],
]);

function createRuntimeId(prefix: string): string {
  const randomSegment = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${randomSegment}`;
}

function parseRetentionDays(value: unknown): number {
  const fallback = Number(process.env.AMRO_KPI_EXPORT_RETENTION_DAYS || 30);
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || !ALLOWED_RETENTION_DAYS.has(Math.trunc(parsed))) {
    return ALLOWED_RETENTION_DAYS.has(fallback) ? fallback : 30;
  }
  return Math.trunc(parsed);
}

function parseStorageTier(value: unknown): StorageTier {
  const fallback = String(process.env.AMRO_KPI_EXPORT_STORAGE_TIER || 'hot').trim().toLowerCase() as StorageTier;
  const normalized = String(value || fallback).trim().toLowerCase() as StorageTier;
  if (!ALLOWED_STORAGE_TIERS.has(normalized)) {
    return ALLOWED_STORAGE_TIERS.has(fallback) ? fallback : 'hot';
  }
  return normalized;
}

function getRetryAttempts(): number {
  return Math.max(1, Number(process.env.AMRO_EXPORT_DEPENDENCY_MAX_RETRIES || 3));
}

function getCircuitFailureThreshold(): number {
  return Math.max(1, Number(process.env.AMRO_EXPORT_CIRCUIT_FAILURE_THRESHOLD || 3));
}

function getCircuitCooldownMs(): number {
  return Math.max(1_000, Number(process.env.AMRO_EXPORT_CIRCUIT_COOLDOWN_MS || 60_000));
}

function resolveFreshnessThresholdSeconds(metricKey: string): number {
  const defaultThreshold = Math.max(60, Number(process.env.AMRO_KPI_CACHE_STALE_SECONDS || KPI_CACHE_STALE_THRESHOLD_SECONDS));
  const raw = String(process.env.AMRO_KPI_FRESHNESS_THRESHOLDS || '').trim();
  if (!raw) return defaultThreshold;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const candidate = Number(parsed[metricKey]);
    if (!Number.isFinite(candidate) || candidate <= 0) return defaultThreshold;
    return Math.round(candidate);
  } catch {
    return defaultThreshold;
  }
}

function getStorageAlertThresholdsBytes(): { warn: number; critical: number } {
  const warnMb = Math.max(1, Number(process.env.AMRO_EXPORT_STORAGE_WARN_MB || 512));
  const criticalMb = Math.max(warnMb + 1, Number(process.env.AMRO_EXPORT_STORAGE_CRITICAL_MB || 1024));
  return {
    warn: warnMb * 1024 * 1024,
    critical: criticalMb * 1024 * 1024,
  };
}

function resolveDependencyState(circuit: CircuitState): DependencyState {
  if (circuit.state === 'open') return 'down';
  if (circuit.failures > 0) return 'degraded';
  return 'healthy';
}

async function runWithResilience<T>(
  dependency: DependencyName,
  operation: () => Promise<T>,
  fallback: (error: Error) => T,
): Promise<{ value: T; fallback_used: boolean; attempts: number; error_message: string | null }> {
  const circuit = DEPENDENCY_CIRCUITS.get(dependency) || { failures: 0, state: 'closed', opened_at: null, last_error: null };
  const now = Date.now();
  if (circuit.state === 'open' && circuit.opened_at && now - circuit.opened_at < getCircuitCooldownMs()) {
    const error = new Error(`${dependency} circuit is open`);
    return {
      value: fallback(error),
      fallback_used: true,
      attempts: 0,
      error_message: error.message,
    };
  }
  if (circuit.state === 'open' && circuit.opened_at && now - circuit.opened_at >= getCircuitCooldownMs()) {
    circuit.state = 'closed';
    circuit.opened_at = null;
  }

  const maxAttempts = getRetryAttempts();
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const value = await operation();
      circuit.failures = 0;
      circuit.state = 'closed';
      circuit.opened_at = null;
      circuit.last_error = null;
      DEPENDENCY_HEALTH.set(dependency, {
        last_success_at: new Date().toISOString(),
        last_failure_at: DEPENDENCY_HEALTH.get(dependency)?.last_failure_at || null,
      });
      DEPENDENCY_CIRCUITS.set(dependency, circuit);
      return { value, fallback_used: false, attempts: attempt, error_message: null };
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      lastError = normalized;
      circuit.failures += 1;
      circuit.last_error = normalized.message;
      DEPENDENCY_HEALTH.set(dependency, {
        last_success_at: DEPENDENCY_HEALTH.get(dependency)?.last_success_at || null,
        last_failure_at: new Date().toISOString(),
      });
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 10));
      }
    }
  }

  if (circuit.failures >= getCircuitFailureThreshold()) {
    circuit.state = 'open';
    circuit.opened_at = Date.now();
  }
  DEPENDENCY_CIRCUITS.set(dependency, circuit);
  const fallbackError = lastError || new Error(`${dependency} failed`);
  return {
    value: fallback(fallbackError),
    fallback_used: true,
    attempts: maxAttempts,
    error_message: fallbackError.message,
  };
}

async function persistIntegrationJobCreate(job: ExportJobRecord, sourceSystem: string): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from('integration_jobs').insert({
      id: job.id,
      tenant_id: job.tenant_id,
      franchise_id: job.franchise_id,
      job_type: 'amro_kpi_export',
      source_system: sourceSystem,
      target_system: 'overview-kpi',
      status: job.status,
      idempotency_key: `${job.tenant_id}:${job.id}`,
      payload: job.payload,
      response_payload: job.response_payload,
      attempts: 0,
      max_attempts: getRetryAttempts(),
      created_at: job.created_at,
      updated_at: job.created_at,
    });
    if (error) {
      throw new Error(error.message || 'Failed to create integration job');
    }
  } catch {
    MEMORY_EXPORT_JOBS.set(job.id, job);
  }
}

async function persistIntegrationJobUpdate(job: ExportJobRecord): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from('integration_jobs')
      .update({
        status: job.status,
        attempts: Number(job.payload.attempts || 0),
        response_payload: job.response_payload,
        error_message: Object.values(job.dependency_failures).join('; ').slice(0, 1024) || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    if (error) {
      throw new Error(error.message || 'Failed to update integration job');
    }
  } catch {
    MEMORY_EXPORT_JOBS.set(job.id, job);
  }
}

async function persistCacheInvalidationAudit(
  tenantId: string,
  franchiseId: string | null,
  reason: CacheInvalidationReason,
  details: Record<string, unknown>,
): Promise<void> {
  const event = {
    id: createRuntimeId('kpi-cache-invalidation'),
    tenant_id: tenantId,
    franchise_id: franchiseId,
    reason,
    event_at: new Date().toISOString(),
    details,
  };
  MEMORY_CACHE_AUDIT.push(event);
  if (MEMORY_CACHE_AUDIT.length > 2000) {
    MEMORY_CACHE_AUDIT.splice(0, MEMORY_CACHE_AUDIT.length - 2000);
  }
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from('integration_jobs').insert({
      tenant_id: tenantId,
      franchise_id: franchiseId,
      job_type: 'amro_kpi_cache_invalidation',
      source_system: 'analytics_pipeline',
      target_system: 'overview-kpi-cache',
      status: 'succeeded',
      idempotency_key: `${tenantId}:${event.id}`,
      payload: {
        reason,
        details,
      },
      response_payload: {
        event_id: event.id,
        event_at: event.event_at,
      },
      attempts: 1,
      max_attempts: 1,
    });
  } catch {
    return;
  }
}

function maxTimestamp(rows: JsonRecord[], keys: string[]): number {
  return rows.reduce((maxValue, row) => {
    const ms = parseDateMs(getStringValue(row, keys));
    if (!Number.isFinite(ms)) return maxValue;
    return Math.max(maxValue, ms);
  }, 0);
}

async function evaluateCacheFreshness(args: {
  tenantId: string;
  franchiseId: string | null;
  cacheAgeSeconds: number;
  snapshot: JsonRecord | null;
  sourceRows: JsonRecord[];
  metricKey: string;
}): Promise<{
  warning: string | null;
  status: 'fresh' | 'stale' | 'refreshing';
  threshold_seconds: number;
  cache_age_seconds: number;
  invalidated: boolean;
  refreshed_at: string;
  cache_hit_ratio: number;
}> {
  const scopeKey = `${args.tenantId}:${args.franchiseId || 'global'}:${args.metricKey}`;
  const state = MEMORY_CACHE_STATE.get(scopeKey) || {
    cache_hits: 0,
    cache_misses: 0,
    last_source_change_ms: 0,
    last_refreshed_at: null,
    last_invalidated_at: null,
  };
  const thresholdSeconds = resolveFreshnessThresholdSeconds(args.metricKey);
  const sourceUpdatedAtMs = maxTimestamp(args.sourceRows, ['updated_at', 'recorded_at', 'detected_at', 'created_at']);
  const snapshotFreshUntilMs = args.snapshot
    ? parseDateMs(getStringValue(args.snapshot, ['cache_fresh_until']))
    : Number.NaN;
  const staleByAge = args.cacheAgeSeconds > thresholdSeconds;
  const staleBySnapshot = Number.isFinite(snapshotFreshUntilMs) && Date.now() > snapshotFreshUntilMs;
  const sourceChanged = sourceUpdatedAtMs > state.last_source_change_ms;
  const invalidated = sourceChanged || staleByAge || staleBySnapshot;
  if (invalidated) {
    state.cache_misses += 1;
    state.last_source_change_ms = Math.max(state.last_source_change_ms, sourceUpdatedAtMs);
    state.last_invalidated_at = new Date().toISOString();
    state.last_refreshed_at = new Date().toISOString();
    await persistCacheInvalidationAudit(
      args.tenantId,
      args.franchiseId,
      sourceChanged ? 'source_update' : staleByAge || staleBySnapshot ? 'stale_threshold' : 'manual_refresh',
      {
        source_updated_at_ms: sourceUpdatedAtMs,
        stale_by_age: staleByAge,
        stale_by_snapshot: staleBySnapshot,
        cache_age_seconds: args.cacheAgeSeconds,
        threshold_seconds: thresholdSeconds,
      },
    );
  } else {
    state.cache_hits += 1;
  }
  MEMORY_CACHE_STATE.set(scopeKey, state);
  const totalAccesses = state.cache_hits + state.cache_misses;
  const cacheHitRatio = totalAccesses > 0 ? Math.round((state.cache_hits / totalAccesses) * 10000) / 100 : 100;
  return {
    warning: staleByAge || staleBySnapshot ? 'Data may be stale; automatic refresh has been triggered' : null,
    status: invalidated ? 'refreshing' : 'fresh',
    threshold_seconds: thresholdSeconds,
    cache_age_seconds: args.cacheAgeSeconds,
    invalidated,
    refreshed_at: state.last_refreshed_at || new Date().toISOString(),
    cache_hit_ratio: cacheHitRatio,
  };
}

function selectTierByAge(createdAtIso: string): StorageTier {
  const ageDays = Math.max(0, Math.floor((Date.now() - Date.parse(createdAtIso)) / (1000 * 60 * 60 * 24)));
  if (ageDays >= 60) return 'cold';
  if (ageDays >= 30) return 'warm';
  return 'hot';
}

function normalizeArtifactFromJob(job: ExportJobRecord): ExportArtifactRecord | null {
  const artifact = job.response_payload.artifact;
  if (!artifact || typeof artifact !== 'object') return null;
  const record = artifact as Record<string, unknown>;
  const tier = parseStorageTier(record.tier);
  const retention = parseRetentionDays(record.retention_days);
  const createdAt = String(record.created_at || job.created_at);
  return {
    key: String(record.key || ''),
    tier: tier || selectTierByAge(createdAt),
    retention_days: retention,
    created_at: createdAt,
    expires_at: String(record.expires_at || createdAt),
    size_bytes: Math.max(0, Number(record.size_bytes || 0)),
    state: String(record.state || 'active') as 'active' | 'expired' | 'purged',
  };
}

function summarizeStorageUsage(jobs: ExportJobRecord[]): {
  total_bytes: number;
  tier_breakdown: Record<StorageTier, number>;
  alert_level: 'ok' | 'warn' | 'critical';
  alerts: string[];
} {
  const tierBreakdown: Record<StorageTier, number> = { hot: 0, warm: 0, cold: 0 };
  let totalBytes = 0;
  for (const job of jobs) {
    const artifact = normalizeArtifactFromJob(job);
    if (!artifact || artifact.state !== 'active') continue;
    totalBytes += artifact.size_bytes;
    tierBreakdown[artifact.tier] += artifact.size_bytes;
  }
  const thresholds = getStorageAlertThresholdsBytes();
  const alertLevel = totalBytes >= thresholds.critical ? 'critical' : totalBytes >= thresholds.warn ? 'warn' : 'ok';
  const alerts: string[] = [];
  if (alertLevel === 'warn') {
    alerts.push('Storage usage exceeded warning threshold');
  }
  if (alertLevel === 'critical') {
    alerts.push('Storage usage exceeded critical threshold');
  }
  return {
    total_bytes: totalBytes,
    tier_breakdown: tierBreakdown,
    alert_level: alertLevel,
    alerts,
  };
}

async function loadExportJobs(tenantId: string): Promise<ExportJobRecord[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('integration_jobs')
      .select('id, tenant_id, franchise_id, status, created_at, payload, response_payload')
      .eq('tenant_id', tenantId)
      .eq('job_type', 'amro_kpi_export')
      .limit(300);
    if (error || !Array.isArray(data)) {
      throw new Error(error?.message || 'Failed to load export jobs');
    }
    return data.map((row) => ({
      id: String((row as JsonRecord).id || ''),
      tenant_id: String((row as JsonRecord).tenant_id || tenantId),
      franchise_id: getStringValue(row as JsonRecord, ['franchise_id']) || null,
      status: (String((row as JsonRecord).status || 'queued') as ExportJobStatus),
      progress_pct: Number(getNumericValue((row as JsonRecord).response_payload as JsonRecord || {}, ['progress_pct'], 0)),
      created_at: getStringValue(row as JsonRecord, ['created_at'], new Date().toISOString()),
      started_at: getStringValue((row as JsonRecord).payload as JsonRecord || {}, ['started_at'], new Date().toISOString()),
      completed_at: getStringValue((row as JsonRecord).response_payload as JsonRecord || {}, ['completed_at']) || null,
      payload: ((row as JsonRecord).payload || {}) as Record<string, unknown>,
      response_payload: ((row as JsonRecord).response_payload || {}) as Record<string, unknown>,
      dependency_failures: {},
    }));
  } catch {
    return Array.from(MEMORY_EXPORT_JOBS.values()).filter((job) => job.tenant_id === tenantId);
  }
}

async function runArtifactCleanupSweep(tenantId: string): Promise<{
  cleanup_job_id: string;
  scanned_jobs: number;
  expired_artifacts: number;
  purged_artifacts: number;
  next_run_at: string;
}> {
  const jobs = await loadExportJobs(tenantId);
  let expiredArtifacts = 0;
  let purgedArtifacts = 0;
  const nowMs = Date.now();
  for (const job of jobs) {
    const artifact = normalizeArtifactFromJob(job);
    if (!artifact) continue;
    if (artifact.state === 'purged') continue;
    const expiresMs = Date.parse(artifact.expires_at);
    if (Number.isFinite(expiresMs) && expiresMs <= nowMs) {
      expiredArtifacts += 1;
      const hardDelete = parseBoolean(process.env.AMRO_EXPORT_HARD_DELETE_EXPIRED, false);
      artifact.state = hardDelete ? 'purged' : 'expired';
      if (artifact.state === 'purged') {
        purgedArtifacts += 1;
      }
      job.response_payload = {
        ...job.response_payload,
        artifact: {
          ...artifact,
        },
        cleanup: {
          state: 'completed',
          completed_at: new Date().toISOString(),
        },
      };
      await persistIntegrationJobUpdate(job);
    }
  }
  return {
    cleanup_job_id: createRuntimeId('kpi-artifact-cleanup'),
    scanned_jobs: jobs.length,
    expired_artifacts: expiredArtifacts,
    purged_artifacts: purgedArtifacts,
    next_run_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

function computeExportSuccessRate(jobs: ExportJobRecord[]): number {
  if (!jobs.length) return 100;
  const succeeded = jobs.filter((job) => job.status === 'succeeded').length;
  return Math.round((succeeded / jobs.length) * 10000) / 100;
}

function hasAnyPermission(permissions: string[], required: string[]): boolean {
  return required.some((permission) => permissions.includes(permission));
}

function resolveOverviewPersona(role: string, permissions: string[]): OverviewPersona {
  const normalizedRole = String(role || '').trim().toLowerCase();
  if (normalizedRole === 'platform_admin' || normalizedRole === 'tenant_admin' || normalizedRole === 'franchise_admin') {
    return 'management';
  }
  if (hasAnyPermission(permissions, ['dashboards.manage', 'reports.manage'])) {
    return 'management';
  }
  return 'planner';
}

function getMaxCompareWindowDays(): number {
  return Number(process.env.AMRO_KPI_COMPARE_WINDOW_MAX_DAYS || 90);
}

function getMaxExportRows(): number {
  return Number(process.env.AMRO_KPI_EXPORT_MAX_ROWS || 5000);
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function isV2Enabled(): boolean {
  return parseBoolean(process.env.AMRO_OVERVIEW_KPI_V2_ENABLED, true);
}

function parseDateRange(value: unknown): { from: string; to: string } {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error('date_range is required');
  }
  let from = '';
  let to = '';
  if (normalized.includes('|')) {
    const parts = normalized.split('|');
    from = String(parts[0] || '').trim();
    to = String(parts[1] || '').trim();
  } else if (normalized.includes(',')) {
    const parts = normalized.split(',');
    from = String(parts[0] || '').trim();
    to = String(parts[1] || '').trim();
  } else if (normalized.includes('Z:')) {
    const [left = '', right = ''] = normalized.split('Z:');
    from = `${String(left || '').trim()}Z`;
    to = String(right || '').trim();
  }
  const fromDate = Date.parse(from);
  const toDate = Date.parse(to);
  if (!Number.isFinite(fromDate) || !Number.isFinite(toDate) || fromDate > toDate) {
    throw new Error('Invalid date_range format. Expected ISO start|end');
  }
  return { from, to };
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function sanitizeScopeFilters(values: string[], filterName: string): string[] {
  const invalid = values.find((item) => !/^[a-zA-Z0-9._:-]{1,80}$/.test(item));
  if (invalid) {
    throw new Error(`Invalid ${filterName} filter`);
  }
  return values;
}

function parseWindowDays(window: string): number {
  const normalized = window.trim().toLowerCase();
  const match = normalized.match(/^(\d+)\s*d$/);
  if (!match) return Number.NaN;
  return Number(match[1]);
}

function assertWithinPolicyWindow(compareWindow: string) {
  if (!compareWindow.trim()) {
    throw new Error('compare_window is required');
  }
  const compareWindowDays = parseWindowDays(compareWindow);
  if (!Number.isFinite(compareWindowDays) || compareWindowDays > getMaxCompareWindowDays()) {
    throw new Error('compare_window cannot exceed policy maximum');
  }
}

function parsePagination(value: unknown, fallback: number, maxValue = MAX_PAGE_SIZE): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized <= 0) return fallback;
  return Math.min(normalized, maxValue);
}

function generateTimeSeries(window: KpiWindow): Array<{ date: string; value: number }> {
  const pointsByWindow: Record<KpiWindow, number> = { '7d': 7, '30d': 10, '90d': 12 };
  const points = pointsByWindow[window];
  const today = new Date();
  return Array.from({ length: points }).map((_, index) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (points - index - 1));
    return {
      date: d.toISOString().slice(0, 10),
      value: 70 + ((index * 3) % 19),
    };
  });
}

function parseBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') {
    return body as Record<string, unknown>;
  }
  return {};
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

function parseDateMs(value: unknown): number {
  if (!value) return Number.NaN;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
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

function normalizePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 1) return Math.max(0, Math.min(100, value * 100));
  return Math.max(0, Math.min(100, value));
}

function isRecentWithinDays(dateValue: string, days: number): boolean {
  const dateMs = parseDateMs(dateValue);
  if (!Number.isFinite(dateMs)) return false;
  return Date.now() - dateMs <= days * 24 * 60 * 60 * 1000;
}

function toIsoDay(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function buildScopedFilterSet(values: string[], tenantId: string): Set<string> {
  const set = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const normalized = trimmed.toLowerCase();
    set.add(normalized);
    if (!normalized.startsWith(`${tenantId.toLowerCase()}:`)) {
      set.add(`${tenantId.toLowerCase()}:${normalized}`);
    }
  }
  return set;
}

function matchesScopeFilter(rowValue: string, filters: Set<string>): boolean {
  if (filters.size === 0) return true;
  const normalized = rowValue.trim().toLowerCase();
  if (!normalized) return false;
  return filters.has(normalized);
}

function filterRowsByScope(
  rows: JsonRecord[],
  filters: {
    tenantId: string;
    stationIds: string[];
    fleetIds: string[];
    regionIds: string[];
    dateFromIso?: string;
    dateToIso?: string;
  },
) {
  const stationFilters = buildScopedFilterSet(filters.stationIds, filters.tenantId);
  const fleetFilters = buildScopedFilterSet(filters.fleetIds, filters.tenantId);
  const regionFilters = buildScopedFilterSet(filters.regionIds, filters.tenantId);
  const fromMs = filters.dateFromIso ? parseDateMs(filters.dateFromIso) : Number.NaN;
  const toMs = filters.dateToIso ? parseDateMs(filters.dateToIso) : Number.NaN;

  return rows.filter((row) => {
    const stationValue = getStringValue(row, ['station_id', 'station', 'hangar', 'location', 'warehouse_id', 'storage_location'], '');
    const fleetValue = getStringValue(row, ['fleet_id', 'fleet', 'fleet_code', 'aircraft_fleet'], '');
    const regionValue = getStringValue(row, ['region_id', 'region', 'region_code'], '');
    const timestampValue = getStringValue(
      row,
      [
        'snapshot_at',
        'due_at',
        'planned_end_at',
        'planned_end',
        'scheduled_end_at',
        'slot_start_at',
        'submitted_at',
        'recorded_at',
        'detected_at',
        'created_at',
        'updated_at',
      ],
      '',
    );
    const timestampMs = parseDateMs(timestampValue);
    const dateMatches = (!Number.isFinite(fromMs) || !Number.isFinite(toMs))
      || !Number.isFinite(timestampMs)
      || (timestampMs >= fromMs && timestampMs <= toMs);

    return matchesScopeFilter(stationValue, stationFilters)
      && matchesScopeFilter(fleetValue, fleetFilters)
      && matchesScopeFilter(regionValue, regionFilters)
      && dateMatches;
  });
}

function filterRowsByDateRange(
  rows: JsonRecord[],
  dateFromIso: string,
  dateToIso: string,
  timestampKeys: string[],
) {
  const fromMs = parseDateMs(dateFromIso);
  const toMs = parseDateMs(dateToIso);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return rows;
  }
  return rows.filter((row) => {
    const timestampValue = getStringValue(row, timestampKeys, '');
    const timestampMs = parseDateMs(timestampValue);
    return Number.isFinite(timestampMs) && timestampMs >= fromMs && timestampMs <= toMs;
  });
}

function paginate<TItem>(items: TItem[], page: number, pageSize: number) {
  const safePage = Math.max(DEFAULT_PAGE, page);
  const safePageSize = Math.max(1, pageSize);
  const offset = (safePage - 1) * safePageSize;
  const pagedItems = items.slice(offset, offset + safePageSize);
  return {
    items: pagedItems,
    pagination: {
      page: safePage,
      page_size: safePageSize,
      total_rows: items.length,
      total_pages: Math.max(1, Math.ceil(items.length / safePageSize)),
    },
  };
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
      let query = supabase
        .from(tableCandidate)
        .select('*')
        .eq('tenant_id', tenantId);
      if (tableCandidate === 'amro_overview_kpi_snapshots' && typeof (query as { order?: unknown }).order === 'function') {
        query = (query as { order: (column: string, options: { ascending: boolean }) => typeof query })
          .order('snapshot_at', { ascending: false });
      }
      const { data, error } = await query.limit(limit);

      if (!error) {
        return Array.isArray(data) ? (data as JsonRecord[]) : [];
      }

      const message = String(error.message || 'database connectivity failure');
      const code = String((error as { code?: string }).code || '');
      if (process.env.NODE_ENV !== 'production' && isInvalidTenantUuidError(message)) {
        let fallbackQuery = supabase
          .from(tableCandidate)
          .select('*');
        if (tableCandidate === 'amro_overview_kpi_snapshots' && typeof (fallbackQuery as { order?: unknown }).order === 'function') {
          fallbackQuery = (fallbackQuery as { order: (column: string, options: { ascending: boolean }) => typeof fallbackQuery })
            .order('snapshot_at', { ascending: false });
        }
        const fallbackResult = await fallbackQuery.limit(limit);
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

function mapWorkPackageOverview(
  rows: JsonRecord[],
  plannerFilter: string | null,
  engineerFilter: string | null,
) {
  const filtered = rows.filter((row) => {
    const plannerId = getStringValue(row, ['planner_id', 'assigned_planner_id', 'assigned_to']);
    const engineerId = getStringValue(row, ['engineer_id', 'assigned_engineer_id', 'lead_engineer_id']);
    const plannerPass = !plannerFilter || plannerId === plannerFilter;
    const engineerPass = !engineerFilter || engineerId === engineerFilter;
    return plannerPass && engineerPass;
  });
  return filtered.slice(0, 15).map((row) => ({
    work_package_id: getStringValue(row, ['id', 'work_package_id', 'code', 'work_package_number'], 'unknown-work-package'),
    title: getStringValue(row, ['title', 'name', 'description', 'work_package_number'], 'Untitled work package'),
    status: resolveStatus(row) || 'unknown',
    planner_id: getStringValue(row, ['planner_id', 'assigned_planner_id', 'assigned_to'], 'unassigned'),
    engineer_id: getStringValue(row, ['engineer_id', 'assigned_engineer_id', 'lead_engineer_id'], 'unassigned'),
    due_at: getStringValue(row, ['due_at', 'planned_end_at', 'target_end_at', 'planned_end', 'scheduled_end_at'], ''),
    progress_pct: Math.round(normalizePercent(getNumericValue(row, ['progress_pct', 'completion_pct', 'completion_percentage'], 0))),
  }));
}

function mapTaskExecutionMonitor(rows: JsonRecord[]) {
  const technicianIds = new Set<string>();
  let completedCount = 0;
  let mobileCompletedCount = 0;
  let productivitySum = 0;
  let productivityCount = 0;

  for (const row of rows) {
    const technicianId = getStringValue(row, ['technician_id', 'assignee_id']);
    if (technicianId) technicianIds.add(technicianId);
    const status = resolveStatus(row);
    const isCompleted = isResolvedStatus(status) || !!row.completed_at;
    if (isCompleted) completedCount += 1;
    const completedOnMobile = Boolean(row.completed_on_mobile || row.mobile_completed || row.mobile_submission);
    if (isCompleted && completedOnMobile) mobileCompletedCount += 1;
    const productivity = getNumericValue(row, ['productivity_score', 'efficiency_score', 'productivity_pct'], Number.NaN);
    if (Number.isFinite(productivity)) {
      productivitySum += productivity;
      productivityCount += 1;
    }
  }

  const averageProductivity = productivityCount > 0 ? productivitySum / productivityCount : 0;
  const mobileRate = completedCount > 0 ? (mobileCompletedCount / completedCount) * 100 : 0;
  return {
    technician_count: technicianIds.size,
    completed_tasks: completedCount,
    average_productivity_pct: Math.round(normalizePercent(averageProductivity) * 10) / 10,
    mobile_completion_rate_pct: Math.round(normalizePercent(mobileRate) * 10) / 10,
  };
}

function mapSchedulingSnapshot(rows: JsonRecord[]) {
  const now = Date.now();
  const nextSevenDays = now + 7 * 24 * 60 * 60 * 1000;
  let utilizationTotal = 0;
  let utilizationCount = 0;
  const upcomingSlots = rows
    .map((row) => ({
      slot_id: getStringValue(row, ['id', 'slot_id'], 'slot-unknown'),
      station: getStringValue(row, ['station_id', 'station', 'hangar'], 'unspecified'),
      start_at: getStringValue(row, ['slot_start_at', 'start_at', 'scheduled_start_at'], ''),
      end_at: getStringValue(row, ['slot_end_at', 'end_at', 'scheduled_end_at'], ''),
      resource: getStringValue(row, ['resource_name', 'team_name', 'resource_id'], 'resource'),
      utilization_pct: Math.round(normalizePercent(getNumericValue(row, ['utilization_pct', 'resource_utilization'], 0)) * 10) / 10,
    }))
    .filter((slot) => {
      const startMs = parseDateMs(slot.start_at);
      return Number.isFinite(startMs) && startMs >= now && startMs <= nextSevenDays;
    })
    .slice(0, 12);

  for (const row of rows) {
    const utilization = getNumericValue(row, ['utilization_pct', 'resource_utilization'], Number.NaN);
    if (Number.isFinite(utilization)) {
      utilizationTotal += normalizePercent(utilization);
      utilizationCount += 1;
    }
  }

  return {
    upcoming_slots: upcomingSlots,
    resource_utilization_pct: utilizationCount ? Math.round((utilizationTotal / utilizationCount) * 10) / 10 : 0,
  };
}

function mapMaterialsAlerts(rows: JsonRecord[]) {
  return rows
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
}

function mapComplianceAttention(rows: JsonRecord[]) {
  return rows
    .map((row) => ({
      gate_id: getStringValue(row, ['id', 'gate_id', 'compliance_gate_id'], 'unknown-gate'),
      gate_name: getStringValue(row, ['gate_name', 'name', 'directive_id'], 'Compliance Gate'),
      status: resolveStatus(row) || 'unknown',
      due_at: getStringValue(row, ['due_at', 'deadline_at', 'target_at'], ''),
      owner_id: getStringValue(row, ['owner_id', 'inspector_id', 'assigned_to'], 'unassigned'),
    }))
    .filter((item) => ['failed', 'blocked', 'open', 'pending', 'at_risk'].includes(item.status))
    .slice(0, 10);
}

function mapComplianceAttentionFromEvents(rows: JsonRecord[]) {
  const openStatuses = new Set(['open', 'acknowledged']);
  const buckets = new Map<string, {
    gate_id: string;
    gate_name: string;
    status: string;
    due_at: string;
    owner_id: string;
    score: number;
  }>();
  for (const row of rows) {
    const eventStatus = getStringValue(row, ['event_status', 'status'], '').toLowerCase();
    if (!openStatuses.has(eventStatus)) continue;
    const eventType = getStringValue(row, ['event_type', 'summary'], 'compliance_event');
    const severity = getStringValue(row, ['severity'], 'medium').toLowerCase();
    const severityScore = severity === 'critical' ? 4 : severity === 'high' ? 3 : severity === 'medium' ? 2 : 1;
    const existing = buckets.get(eventType);
    const status = severity === 'critical' || severity === 'high' ? 'failed' : 'open';
    if (!existing) {
      buckets.set(eventType, {
        gate_id: getStringValue(row, ['event_code', 'id'], `evt-${eventType}`),
        gate_name: eventType.replace(/_/g, ' '),
        status,
        due_at: getStringValue(row, ['detected_at', 'created_at'], ''),
        owner_id: getStringValue(row, ['updated_by', 'created_by'], 'system'),
        score: severityScore,
      });
      continue;
    }
    existing.score += severityScore;
    if (status === 'failed') {
      existing.status = 'failed';
    }
    const detectedAt = getStringValue(row, ['detected_at', 'created_at'], '');
    if (parseDateMs(detectedAt) > parseDateMs(existing.due_at)) {
      existing.due_at = detectedAt;
    }
  }
  return Array.from(buckets.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, 10)
    .map(({ score: _score, ...item }) => item);
}

function mapCertificationQueue(rows: JsonRecord[]) {
  return rows
    .map((row) => ({
      certification_id: getStringValue(row, ['id', 'certification_id'], 'unknown-certification'),
      work_package_id: getStringValue(row, ['work_package_id', 'package_id'], 'unknown-work-package'),
      authority: getStringValue(row, ['authority', 'certifying_authority', 'regulator'], 'unspecified'),
      status: resolveStatus(row) || 'unknown',
      submitted_at: getStringValue(row, ['submitted_at', 'created_at'], ''),
    }))
    .filter((item) => ['pending', 'in_review', 'awaiting_signature', 'queued'].includes(item.status))
    .slice(0, 10);
}

function mapAuditTimeline(rows: JsonRecord[]) {
  return rows
    .map((row) => ({
      event_id: getStringValue(row, ['id', 'event_id', 'audit_id'], 'unknown-event'),
      action: getStringValue(row, ['action', 'event_type', 'activity'], 'audit-event'),
      actor: getStringValue(row, ['actor', 'actor_id', 'performed_by'], 'system'),
      created_at: getStringValue(row, ['created_at', 'event_at', 'recorded_at'], ''),
      outcome: getStringValue(row, ['outcome', 'status', 'result'], 'recorded'),
    }))
    .sort((left, right) => parseDateMs(right.created_at) - parseDateMs(left.created_at))
    .slice(0, 12);
}

function mapIntegrationMonitor(rows: JsonRecord[]) {
  let failedAttempts = 0;
  const recentFailures = rows
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
      return failed && isRecentWithinDays(entry.last_attempt_at, 7);
    })
    .sort((left, right) => parseDateMs(right.last_attempt_at) - parseDateMs(left.last_attempt_at))
    .slice(0, 8);

  const failureRate = rows.length ? (failedAttempts / rows.length) * 100 : 0;
  return {
    status: failureRate > 15 ? 'degraded' : 'healthy',
    failed_attempts: failedAttempts,
    failure_rate_pct: Math.round(failureRate * 10) / 10,
    recent_failures: recentFailures,
  };
}

function mapIntegrationMonitorFromComplianceEvents(rows: JsonRecord[]) {
  if (rows.length === 0) {
    return {
      status: 'healthy',
      failed_attempts: 0,
      failure_rate_pct: 0,
      recent_failures: [],
    };
  }
  const criticalStatuses = new Set(['open', 'acknowledged']);
  const severeRows = rows
    .filter((row) => {
      const status = getStringValue(row, ['event_status', 'status'], '').toLowerCase();
      const severity = getStringValue(row, ['severity'], '').toLowerCase();
      return criticalStatuses.has(status) && (severity === 'critical' || severity === 'high');
    })
    .sort((left, right) => parseDateMs(getStringValue(right, ['detected_at', 'created_at'])) - parseDateMs(getStringValue(left, ['detected_at', 'created_at'])))
    .slice(0, 8);
  const failedAttempts = severeRows.length;
  const failureRate = (failedAttempts / Math.max(1, rows.length)) * 100;
  return {
    status: failureRate > 15 ? 'degraded' : 'healthy',
    failed_attempts: failedAttempts,
    failure_rate_pct: Math.round(failureRate * 10) / 10,
    recent_failures: severeRows.map((row, index) => ({
      integration_id: getStringValue(row, ['event_code', 'id'], `compliance-${index + 1}`),
      status: getStringValue(row, ['event_status'], 'open'),
      direction: 'amro-compliance',
      last_attempt_at: getStringValue(row, ['detected_at', 'created_at'], ''),
      error_message: getStringValue(row, ['summary', 'event_type'], 'Compliance signal raised'),
    })),
  };
}

function mapForecastRecommendations(rows: JsonRecord[]) {
  const mapped = rows
    .map((row) => {
      const confidence = normalizePercent(getNumericValue(row, ['confidence_pct', 'confidence_score'], 0));
      const riskScore = normalizePercent(getNumericValue(row, ['risk_score', 'risk_pct'], 0));
      return {
        recommendation_id: getStringValue(row, ['id', 'recommendation_id'], 'forecast'),
        work_package_id: getStringValue(row, ['work_package_id', 'package_id'], 'unknown-work-package'),
        recommendation: getStringValue(row, ['recommendation', 'action', 'suggested_action'], 'Review intervention plan'),
        confidence_pct: Math.round(confidence * 10) / 10,
        risk_score: Math.round(riskScore * 10) / 10,
        reason: getStringValue(row, ['reason', 'explainability', 'rationale'], 'Model-derived recommendation'),
      };
    })
    .sort((left, right) => right.risk_score - left.risk_score || right.confidence_pct - left.confidence_pct)
    .slice(0, 10);

  const forecastAccuracy = mapped.length
    ? mapped.reduce((sum, item) => sum + item.confidence_pct, 0) / mapped.length
    : 0;

  return {
    items: mapped,
    forecast_accuracy_pct: Math.round(forecastAccuracy * 10) / 10,
  };
}

function mapForecastRecommendationsFromTelemetry(rows: JsonRecord[]) {
  const grouped = new Map<string, { count: number; total: number; peak: number }>();
  for (const row of rows) {
    const metricKey = getStringValue(row, ['metric_key'], '').toLowerCase();
    if (!metricKey) continue;
    const value = getNumericValue(row, ['metric_value', 'value'], Number.NaN);
    if (!Number.isFinite(value)) continue;
    const current = grouped.get(metricKey) || { count: 0, total: 0, peak: Number.NEGATIVE_INFINITY };
    current.count += 1;
    current.total += value;
    current.peak = Math.max(current.peak, value);
    grouped.set(metricKey, current);
  }
  const items = Array.from(grouped.entries())
    .map(([metricKey, summary], index) => {
      const average = summary.total / Math.max(1, summary.count);
      const varianceScore = Math.max(0, ((summary.peak - average) / Math.max(1, Math.abs(average))) * 100);
      const riskScore = Math.min(100, Math.round(varianceScore * 10) / 10);
      const confidencePct = Math.max(35, Math.min(98, Math.round((100 - (varianceScore * 0.55)) * 10) / 10));
      return {
        recommendation_id: `telemetry-${metricKey}-${index + 1}`,
        work_package_id: 'telemetry-derived',
        recommendation: `Investigate ${metricKey.replace(/_/g, ' ')} drift`,
        confidence_pct: confidencePct,
        risk_score: riskScore,
        reason: `${summary.count} telemetry samples analyzed`,
      };
    })
    .sort((left, right) => right.risk_score - left.risk_score)
    .slice(0, 10);
  const forecastAccuracy = items.length
    ? items.reduce((sum, item) => sum + item.confidence_pct, 0) / items.length
    : 0;
  return {
    items,
    forecast_accuracy_pct: Math.round(forecastAccuracy * 10) / 10,
  };
}

function buildTrendSeriesFromTasks(rows: JsonRecord[], window: KpiWindow) {
  const pointsByWindow: Record<KpiWindow, number> = { '7d': 7, '30d': 30, '90d': 90 };
  const totalDays = pointsByWindow[window];
  const today = new Date();
  const histogram = new Map<string, number>();
  for (const row of rows) {
    const timestamp = getStringValue(row, ['completed_at', 'updated_at', 'created_at']);
    const day = toIsoDay(timestamp);
    if (!day) continue;
    histogram.set(day, (histogram.get(day) || 0) + 1);
  }
  return Array.from({ length: totalDays }).map((_, index) => {
    const current = new Date(today);
    current.setDate(today.getDate() - (totalDays - index - 1));
    const day = current.toISOString().slice(0, 10);
    return {
      date: day,
      value: histogram.get(day) || 0,
    };
  });
}

function buildTrendSeriesFromTelemetry(rows: JsonRecord[], window: KpiWindow) {
  const pointsByWindow: Record<KpiWindow, number> = { '7d': 7, '30d': 30, '90d': 90 };
  const totalDays = pointsByWindow[window];
  const today = new Date();
  const histogram = new Map<string, number>();
  for (const row of rows) {
    const day = toIsoDay(getStringValue(row, ['recorded_at', 'created_at']));
    if (!day) continue;
    histogram.set(day, (histogram.get(day) || 0) + 1);
  }
  return Array.from({ length: totalDays }).map((_, index) => {
    const current = new Date(today);
    current.setDate(today.getDate() - (totalDays - index - 1));
    const day = current.toISOString().slice(0, 10);
    return {
      date: day,
      value: histogram.get(day) || 0,
    };
  });
}

function resolveSnapshotPersona(persona: OverviewPersona): string {
  return persona === 'planner' ? 'planner' : 'management';
}

function parseIsoDate(value: unknown): number {
  if (!value) return Number.NaN;
  const date = String(value).trim();
  if (!date) return Number.NaN;
  const normalized = date.includes('T') ? date : `${date}T00:00:00.000Z`;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function selectLatestOverviewSnapshot(
  rows: JsonRecord[],
  persona: OverviewPersona,
  franchiseId: string | null,
  rangeFromIso: string,
  rangeToIso: string,
): JsonRecord | null {
  const personaCandidate = resolveSnapshotPersona(persona);
  const fromMs = parseIsoDate(rangeFromIso);
  const toMs = parseIsoDate(rangeToIso);
  const overlapRows = rows.filter((row) => {
    const snapshotFrom = parseIsoDate(row.date_range_start);
    const snapshotTo = parseIsoDate(row.date_range_end);
    if (!Number.isFinite(snapshotFrom) || !Number.isFinite(snapshotTo)) return false;
    const overlapsRange = Number.isFinite(fromMs) && Number.isFinite(toMs)
      ? snapshotFrom <= toMs && snapshotTo >= fromMs
      : true;
    if (!overlapsRange) return false;
    const rowFranchiseId = getStringValue(row, ['franchise_id'], '');
    if (franchiseId && rowFranchiseId && rowFranchiseId !== franchiseId) return false;
    return true;
  });
  const samePersona = overlapRows.filter(
    (row) => getStringValue(row, ['persona'], '').toLowerCase() === personaCandidate,
  );
  const managementFallback = overlapRows.filter(
    (row) => getStringValue(row, ['persona'], '').toLowerCase() === 'management',
  );
  const candidates = samePersona.length > 0 ? samePersona : managementFallback;
  if (candidates.length === 0) return null;
  return candidates
    .slice()
    .sort(
      (left, right) => parseDateMs(getStringValue(right, ['snapshot_at', 'created_at'])) - parseDateMs(getStringValue(left, ['snapshot_at', 'created_at'])),
    )[0] || null;
}

function mapRiskHeatmapFromSnapshot(
  snapshot: JsonRecord | null,
  defaultCells: Array<{ station: string; severity: string; score: number }>,
  tenantId: string,
): Array<{ station: string; severity: string; score: number }> {
  if (!snapshot) return defaultCells;
  const rawHeatmap = snapshot.risk_heatmap;
  if (!rawHeatmap || typeof rawHeatmap !== 'object' || Array.isArray(rawHeatmap)) return defaultCells;
  const objectEntries = Object.entries(rawHeatmap as Record<string, unknown>);
  if (objectEntries.length === 0) return defaultCells;
  const mapped = objectEntries
    .map(([station, value]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
      const bucket = value as Record<string, unknown>;
      const critical = getNumericValue(bucket, ['critical'], 0);
      const high = getNumericValue(bucket, ['high'], 0);
      const medium = getNumericValue(bucket, ['medium'], 0);
      const low = getNumericValue(bucket, ['low'], 0);
      const weightedScore = Math.max(0, Math.min(100, critical * 25 + high * 15 + medium * 8 + low * 3));
      const severity = critical > 0 || high >= 3
        ? 'high'
        : high > 0 || medium > 0
          ? 'medium'
          : 'low';
      return {
        station: station.includes(':') ? station : `${tenantId}:${station}`,
        severity,
        score: Math.round(weightedScore),
      };
    })
    .filter((entry): entry is { station: string; severity: string; score: number } => Boolean(entry))
    .slice(0, 12);
  return mapped.length > 0 ? mapped : defaultCells;
}

function mapTrendLinesFromSnapshot(
  snapshot: JsonRecord | null,
  defaultLines: Array<{ metric_key: string; points: Array<{ date: string; value: number }> }>,
  baseline: { openWorkPackages: number; complianceStatusPct: number; inProgressTasks: number; slaBreachCount: number },
): Array<{ metric_key: string; points: Array<{ date: string; value: number }> }> {
  if (!snapshot) return defaultLines;
  const trendLines = Array.isArray(snapshot.trend_lines) ? snapshot.trend_lines : [];
  if (trendLines.length === 0) return defaultLines;
  const generated = trendLines
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const trend = entry as JsonRecord;
      const metricName = getStringValue(trend, ['metric_key', 'metric'], '').trim().toLowerCase();
      if (!metricName) return null;
      const seededPoints = Array.isArray(trend.points)
        ? trend.points
          .map((point) => {
            if (!point || typeof point !== 'object') return null;
            const pointRecord = point as JsonRecord;
            const date = getStringValue(pointRecord, ['date', 'day'], '');
            const parsedDate = toIsoDay(date);
            const value = getNumericValue(pointRecord, ['value', 'count', 'score'], Number.NaN);
            if (!parsedDate || !Number.isFinite(value)) return null;
            return {
              date: parsedDate,
              value: Math.round(Math.max(0, value) * 10) / 10,
            };
          })
          .filter((point): point is { date: string; value: number } => Boolean(point))
        : [];
      if (seededPoints.length > 0) {
        return {
          metric_key: metricName,
          points: seededPoints,
        };
      }
      const slope = getNumericValue(trend, ['slope', 'delta', 'change_per_day'], 0);
      const baseValue = metricName.includes('sla')
        ? baseline.slaBreachCount
        : metricName.includes('compliance')
          ? baseline.complianceStatusPct
          : metricName.includes('task')
            ? baseline.inProgressTasks
            : baseline.openWorkPackages;
      const points = generateTimeSeries('30d').map((point, index) => ({
        date: point.date,
        value: Math.max(0, Math.round((baseValue + (slope * index * 10)) * 10) / 10),
      }));
      return {
        metric_key: metricName,
        points,
      };
    })
    .filter((entry): entry is { metric_key: string; points: Array<{ date: string; value: number }> } => Boolean(entry));
  return generated.length > 0 ? generated : defaultLines;
}

function mapAnomalyFlagsFromSnapshot(
  snapshot: JsonRecord | null,
  tenantId: string,
): Array<{ id: string; metric_key: string; severity: string; message: string }> {
  if (!snapshot || !Array.isArray(snapshot.anomaly_alerts)) return [];
  return snapshot.anomaly_alerts
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const anomaly = entry as JsonRecord;
      const metric = getStringValue(anomaly, ['metric_key', 'metric'], 'operational_anomaly');
      const count = getNumericValue(anomaly, ['count', 'event_count', 'alerts'], 1);
      const severityRaw = getStringValue(anomaly, ['severity', 'risk'], '').toLowerCase();
      const severity = ['critical', 'high', 'medium', 'low'].includes(severityRaw)
        ? severityRaw
        : count >= 3
          ? 'high'
          : 'medium';
      return {
        id: `${tenantId}-snapshot-anomaly-${index + 1}`,
        metric_key: metric,
        severity,
        message: `${metric.replace(/_/g, ' ')} flagged ${Math.max(1, Math.round(count))} time(s)`,
      };
    })
    .filter((entry): entry is { id: string; metric_key: string; severity: string; message: string } => Boolean(entry))
    .slice(0, 6);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const initialDecision = resolveGatewayCompatibility(req);
  applyCompatibilityResponseHeaders(res, initialDecision, ctx.correlationId);

  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed`, correlationId: ctx.correlationId, version: 'v2' });
    }

    if (!isV2Enabled()) {
      return res.status(404).json({
        error: 'AMRO overview KPI v2 endpoint is disabled',
        correlationId: ctx.correlationId,
        version: 'v2',
      });
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    const access = await resolveAndApplyAccessContext(req, ctx);
    const compatDecision = resolveGatewayCompatibility(req, {
      tenantId: access.tenantId,
      franchiseId: access.franchiseId,
    });
    applyCompatibilityResponseHeaders(res, compatDecision, ctx.correlationId);
    const amroAccess = await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });

    const tenantId = String(access.tenantId || '');
    const franchiseId = access.franchiseId ? String(access.franchiseId) : null;
    const scope = createAmroIsolationScope(tenantId, franchiseId);
    const serviceBoundaries = buildAmroServiceBoundaryEnvelope({
      capability: 'work-packages',
      scope,
      subscriptionStatus: amroAccess.subscriptionStatus,
      validatedAt: amroAccess.validatedAt,
    });

    const interfaceName = String(req.query.interface || '').trim().toLowerCase();
    enforceAmroSequentialMilestoneForOverviewKpiInterface(interfaceName);
    const stationIds = sanitizeScopeFilters(parseStringArray(req.query.station_ids), 'station_ids');
    const fleetIds = sanitizeScopeFilters(parseStringArray(req.query.fleet_ids), 'fleet_ids');
    const regionIds = sanitizeScopeFilters(parseStringArray(req.query.region_ids), 'region_ids');
    const page = parsePagination(req.query.page, DEFAULT_PAGE, Number.MAX_SAFE_INTEGER);
    const pageSize = parsePagination(req.query.page_size, DEFAULT_PAGE_SIZE);
    const scopeStationIds = stationIds.map((id) => `${tenantId}:${id}`);
    const scopeFleetIds = fleetIds.map((id) => `${tenantId}:${id}`);
    const scopeRegionIds = regionIds.map((id) => `${tenantId}:${id}`);
    const plannerId = String(req.query.planner_id || '').trim() || null;
    const engineerId = String(req.query.engineer_id || '').trim() || null;
    const persona = resolveOverviewPersona(auth.role, auth.permissions || []);
    const effectivePlannerId = persona === 'planner' ? (plannerId || auth.userId || null) : plannerId;

    if (req.method === 'GET' && interfaceName === 'load-kpi-dashboard') {
      const dateRange = parseDateRange(req.query.date_range);
      const regulatorProfile = String(req.query.regulator_profile || '').trim() || 'default';
      const cacheAgeSeconds = Math.max(0, Number(req.query.cache_age_seconds || process.env.AMRO_KPI_CACHE_AGE_SECONDS || 120));
      const dataIssues: string[] = [];
      const sharedFilters = {
        tenantId,
        stationIds,
        fleetIds,
        regionIds,
        dateFromIso: dateRange.from,
        dateToIso: dateRange.to,
      };

      const [
        workPackageRows,
        materialsRows,
        complianceRows,
        integrationRows,
        forecastRows,
        overviewSnapshotRows,
        telemetryRows,
        complianceEventRows,
        slaDefinitionRows,
      ] = await Promise.all([
        fetchScopedRows('work_package_master', tenantId, 200, dataIssues),
        fetchScopedRows('materials_inventory', tenantId, 200, dataIssues),
        fetchScopedRows('compliance_gates', tenantId, 200, dataIssues),
        fetchScopedRows('integration_logs', tenantId, 200, dataIssues),
        fetchScopedRows('forecast_recommendations', tenantId, 200, dataIssues),
        fetchScopedRows('amro_overview_kpi_snapshots', tenantId, 60, dataIssues),
        fetchScopedRows('amro_operational_telemetry', tenantId, 1200, dataIssues),
        fetchScopedRows('amro_compliance_events', tenantId, 600, dataIssues),
        fetchScopedRows('amro_sla_definitions', tenantId, 120, dataIssues),
      ]);

      const now = Date.now();
      const snapshot = selectLatestOverviewSnapshot(overviewSnapshotRows, persona, franchiseId, dateRange.from, dateRange.to);
      const scopedWorkPackageRows = filterRowsByScope(workPackageRows, sharedFilters);
      const scopedMaterialsRows = filterRowsByScope(materialsRows, sharedFilters);
      const scopedComplianceRows = filterRowsByScope(complianceRows, sharedFilters);
      const scopedIntegrationRows = filterRowsByScope(integrationRows, sharedFilters);
      const scopedForecastRows = filterRowsByScope(forecastRows, sharedFilters);
      const scopedTelemetryRows = filterRowsByDateRange(telemetryRows, dateRange.from, dateRange.to, ['recorded_at', 'created_at']);
      const scopedComplianceEventRows = filterRowsByDateRange(complianceEventRows, dateRange.from, dateRange.to, ['detected_at', 'created_at']);
      const activeWorkPackagesFromRows = scopedWorkPackageRows.filter((row) => !isResolvedStatus(resolveStatus(row))).length;
      const overdueTasksApproxFromRows = scopedWorkPackageRows.filter((row) => {
        const dueMs = parseDateMs(getStringValue(row, ['due_at', 'planned_end_at', 'target_end_at']));
        const status = resolveStatus(row);
        return Number.isFinite(dueMs) && dueMs < now && !isResolvedStatus(status);
      }).length;
      const compliancePassed = scopedComplianceRows.filter((row) => ['passed', 'approved', 'resolved'].includes(resolveStatus(row))).length;
      const compliancePctFromRows = scopedComplianceRows.length ? (compliancePassed / scopedComplianceRows.length) * 100 : 0;
      const forecast = scopedForecastRows.length > 0
        ? mapForecastRecommendations(scopedForecastRows)
        : mapForecastRecommendationsFromTelemetry(scopedTelemetryRows);
      const fullWorkPackageOverview = mapWorkPackageOverview(scopedWorkPackageRows, effectivePlannerId, engineerId);
      const workPackageOverviewPaging = paginate(fullWorkPackageOverview, page, pageSize);
      const materialsAlerts = mapMaterialsAlerts(scopedMaterialsRows);
      const complianceAttention = scopedComplianceRows.length > 0
        ? mapComplianceAttention(scopedComplianceRows)
        : mapComplianceAttentionFromEvents(scopedComplianceEventRows);
      const integrationMonitor = scopedIntegrationRows.length > 0
        ? mapIntegrationMonitor(scopedIntegrationRows)
        : mapIntegrationMonitorFromComplianceEvents(scopedComplianceEventRows);
      const scopedIntegrationMonitor = persona === 'management'
        ? integrationMonitor
        : {
          status: integrationMonitor.status,
          failed_attempts: integrationMonitor.failed_attempts,
          failure_rate_pct: integrationMonitor.failure_rate_pct,
          recent_failures: [],
        };
      const defaultRiskHeatmapCells = complianceAttention.slice(0, 8).map((item, index) => ({
        station: fullWorkPackageOverview[index]?.planner_id || scopeStationIds[index] || `${tenantId}:station-${index + 1}`,
        severity: item.status === 'failed' ? 'high' : item.status === 'blocked' ? 'medium' : 'low',
        score: item.status === 'failed' ? 90 : item.status === 'blocked' ? 65 : 30,
      }));
      const snapshotOpenWorkPackages = snapshot ? Math.max(0, Math.round(getNumericValue(snapshot, ['open_work_packages'], activeWorkPackagesFromRows))) : activeWorkPackagesFromRows;
      const snapshotOverdueTasks = snapshot ? Math.max(0, Math.round(getNumericValue(snapshot, ['sla_breach_count', 'deferred_items'], overdueTasksApproxFromRows))) : overdueTasksApproxFromRows;
      const snapshotComplianceAlerts = snapshot
        ? Math.max(0, Math.round(getNumericValue(snapshot, ['compliance_alerts'], 0)))
        : Math.max(
          complianceAttention.length,
          scopedComplianceEventRows.filter((row) => ['critical', 'high'].includes(getStringValue(row, ['severity'], '').toLowerCase())).length,
        );
      const snapshotAogCount = snapshot
        ? Math.max(0, Math.round(getNumericValue(snapshot, ['aog_count'], 0)))
        : scopedWorkPackageRows.filter((row) => resolveStatus(row).includes('aog')).length;
      const snapshotDeferredItems = snapshot
        ? Math.max(0, Math.round(getNumericValue(snapshot, ['deferred_items'], 0)))
        : scopedWorkPackageRows.filter((row) => ['deferred', 'blocked', 'on_hold'].includes(resolveStatus(row))).length;
      const snapshotComplianceStatusPct = snapshot
        ? Math.max(0, Math.min(100, Math.round(((snapshotOpenWorkPackages / Math.max(1, snapshotOpenWorkPackages + snapshotComplianceAlerts)) * 100) * 10) / 10))
        : Math.round(compliancePctFromRows * 10) / 10;
      const snapshotInProgressTasks = snapshot
        ? Math.max(0, Math.round(getNumericValue(snapshot, ['in_progress_tasks'], 0)))
        : scopedWorkPackageRows.filter((row) => resolveStatus(row) === 'in_progress').length;
      const dashboardTrendLines = mapTrendLinesFromSnapshot(
        snapshot,
        [
          { metric_key: 'open_work_packages', points: generateTimeSeries('30d').map((point) => ({ ...point, value: Math.max(0, snapshotOpenWorkPackages + point.value % 4) })) },
          { metric_key: 'compliance_status_pct', points: generateTimeSeries('30d').map((point) => ({ ...point, value: Math.max(0, Math.min(100, Math.round(snapshotComplianceStatusPct + (point.value % 5) - 2))) })) },
        ],
        {
          openWorkPackages: snapshotOpenWorkPackages,
          complianceStatusPct: snapshotComplianceStatusPct,
          inProgressTasks: snapshotInProgressTasks,
          slaBreachCount: snapshotOverdueTasks,
        },
      );
      const riskHeatmapCells = mapRiskHeatmapFromSnapshot(snapshot, defaultRiskHeatmapCells, tenantId);
      const snapshotAnomalyFlags = mapAnomalyFlagsFromSnapshot(snapshot, tenantId);
      const anomalyFlags = snapshotAnomalyFlags.length > 0
        ? snapshotAnomalyFlags
        : scopedIntegrationMonitor.recent_failures.slice(0, 3).map((failure, index) => ({
          id: `${tenantId}-anomaly-${index + 1}`,
          metric_key: 'integration_failures',
          severity: failure.status === 'timeout' ? 'medium' : 'high',
          message: failure.error_message || `Integration ${failure.integration_id} reported ${failure.status}`,
        }));
      const freshness = await evaluateCacheFreshness({
        tenantId,
        franchiseId,
        cacheAgeSeconds,
        snapshot,
        sourceRows: [
          ...scopedWorkPackageRows,
          ...scopedComplianceRows,
          ...scopedIntegrationRows,
          ...scopedTelemetryRows,
          ...scopedComplianceEventRows,
        ],
        metricKey: 'overview_dashboard',
      });
      if (dataIssues.length > 0) {
        logApiEvent('warn', 'AMRO overview KPI data issues detected', {
          correlationId: ctx.correlationId,
          tenantId,
          franchiseId,
          interface: 'load-kpi-dashboard',
          issueCount: dataIssues.length,
          issues: dataIssues.slice(0, 10),
        });
      }

      return res.status(200).json({
        version: 'v2',
        interface: 'load-kpi-dashboard',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        scope,
        serviceBoundaries,
        input: {
          date_range: dateRange,
          station_ids: scopeStationIds,
          fleet_ids: scopeFleetIds,
          region_ids: scopeRegionIds,
          regulator_profile: regulatorProfile,
          planner_id: plannerId,
          engineer_id: engineerId,
          page,
          page_size: pageSize,
        },
        output: {
          executive_summary: {
            active_work_packages: snapshotOpenWorkPackages,
            overdue_tasks: snapshotOverdueTasks,
            compliance_status_pct: snapshotComplianceStatusPct,
            forecast_accuracy_pct: forecast.forecast_accuracy_pct,
          },
          kpi_cards: [
            { key: 'open_work_packages', label: 'Open Work Packages', value: snapshotOpenWorkPackages, trend: snapshotOpenWorkPackages > 0 ? '+2%' : '0%' },
            { key: 'in_progress_tasks', label: 'In Progress Tasks', value: snapshotInProgressTasks, trend: snapshotInProgressTasks > 0 ? '+1.1%' : '0%' },
            { key: 'deferred_items', label: 'Deferred Items', value: snapshotDeferredItems, trend: snapshotDeferredItems > 0 ? '+0.9%' : '0%' },
            { key: 'aog_count', label: 'AOG Count', value: snapshotAogCount, trend: snapshotAogCount > 0 ? '+0.4%' : '0%' },
            { key: 'overdue_tasks', label: 'Overdue Tasks', value: snapshotOverdueTasks, trend: snapshotOverdueTasks > 0 ? '+1%' : '0%' },
            { key: 'compliance_status_pct', label: 'Compliance Status %', value: snapshotComplianceStatusPct, trend: snapshotComplianceStatusPct >= 95 ? '+0.5%' : '-0.8%' },
            { key: 'forecast_accuracy_pct', label: 'Forecast Accuracy %', value: forecast.forecast_accuracy_pct, trend: forecast.forecast_accuracy_pct >= 90 ? '+1.2%' : '-0.4%' },
          ],
          risk_heatmap: {
            cells: riskHeatmapCells,
          },
          trend_lines: dashboardTrendLines,
          anomaly_flags: anomalyFlags,
          work_package_overview: workPackageOverviewPaging.items,
          pagination: workPackageOverviewPaging.pagination,
          materials_reservation_alerts: materialsAlerts,
          compliance_gate_status: complianceAttention,
          integration_monitor: scopedIntegrationMonitor,
          screen_modules: {
            total_modules: 12,
            management_and_planner_landing: true,
          },
          role_scope: {
            persona,
            planner_id: effectivePlannerId,
            restricted_sections: persona === 'management' ? [] : ['integration_monitor.recent_failures', 'anomaly_flags'],
          },
          seeded_sources: {
            overview_snapshots: overviewSnapshotRows.length,
            operational_telemetry: scopedTelemetryRows.length,
            compliance_events: scopedComplianceEventRows.length,
            sla_definitions: slaDefinitionRows.length,
          },
          snapshot_metadata: snapshot
            ? {
              snapshot_id: getStringValue(snapshot, ['id']),
              snapshot_at: getStringValue(snapshot, ['snapshot_at', 'created_at']),
              persona: getStringValue(snapshot, ['persona']),
              date_range_start: getStringValue(snapshot, ['date_range_start']),
              date_range_end: getStringValue(snapshot, ['date_range_end']),
            }
            : null,
          data_issues: dataIssues,
          freshness_warning: freshness.warning,
          freshness: {
            status: freshness.status,
            threshold_seconds: freshness.threshold_seconds,
            cache_age_seconds: freshness.cache_age_seconds,
            invalidated: freshness.invalidated,
            refreshed_at: freshness.refreshed_at,
            cache_hit_ratio: freshness.cache_hit_ratio,
          },
        },
      });
    }

    if (req.method === 'GET' && interfaceName === 'export-dependency-health') {
      const dependencyHealth = (['analytics_worker', 'object_storage', 'signed_download'] as DependencyName[]).map((dependency) => {
        const circuit = DEPENDENCY_CIRCUITS.get(dependency) || { failures: 0, state: 'closed', opened_at: null, last_error: null };
        const health = DEPENDENCY_HEALTH.get(dependency) || { last_success_at: null, last_failure_at: null };
        return {
          dependency,
          state: resolveDependencyState(circuit),
          circuit_state: circuit.state,
          failure_count: circuit.failures,
          opened_at: circuit.opened_at ? new Date(circuit.opened_at).toISOString() : null,
          last_error: circuit.last_error,
          last_success_at: health.last_success_at,
          last_failure_at: health.last_failure_at,
        };
      });
      return res.status(200).json({
        version: 'v2',
        interface: 'export-dependency-health',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        scope,
        serviceBoundaries,
        output: {
          dependencies: dependencyHealth,
          availability: dependencyHealth.every((item) => item.state !== 'down') ? 'available' : 'degraded',
          checked_at: new Date().toISOString(),
        },
      });
    }

    if (req.method === 'GET' && interfaceName === 'load-export-monitoring-dashboard') {
      const jobs = await loadExportJobs(tenantId);
      const storage = summarizeStorageUsage(jobs);
      const cacheKey = `${tenantId}:${franchiseId || 'global'}:overview_dashboard`;
      const cacheState = MEMORY_CACHE_STATE.get(cacheKey) || {
        cache_hits: 0,
        cache_misses: 0,
        last_source_change_ms: 0,
        last_refreshed_at: null,
        last_invalidated_at: null,
      };
      const totalCacheRequests = cacheState.cache_hits + cacheState.cache_misses;
      const cacheRatio = totalCacheRequests > 0 ? Math.round((cacheState.cache_hits / totalCacheRequests) * 10000) / 100 : 100;
      return res.status(200).json({
        version: 'v2',
        interface: 'load-export-monitoring-dashboard',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        scope,
        serviceBoundaries,
        output: {
          export_success_rate_pct: computeExportSuccessRate(jobs),
          export_volume: {
            total_jobs: jobs.length,
            completed_jobs: jobs.filter((job) => job.status === 'succeeded').length,
            failed_jobs: jobs.filter((job) => job.status === 'failed').length,
          },
          storage_usage: storage,
          cache_metrics: {
            hit_count: cacheState.cache_hits,
            miss_count: cacheState.cache_misses,
            hit_ratio_pct: cacheRatio,
            last_refreshed_at: cacheState.last_refreshed_at,
            last_invalidated_at: cacheState.last_invalidated_at,
          },
          generated_at: new Date().toISOString(),
        },
      });
    }

    if (req.method === 'GET' && interfaceName === 'load-operational-trends') {
      const metricKey = String(req.query.metric_key || '').trim();
      const window = String(req.query.window || '').trim().toLowerCase() as KpiWindow;
      const compareWindow = String(req.query.compare_window || '').trim();

      if (!ALLOWED_METRIC_KEYS.has(metricKey)) {
        throw new Error('metric_key must be allow-listed');
      }
      if (!ALLOWED_WINDOWS.has(window)) {
        throw new Error('window must be one of 7d, 30d, 90d');
      }
      assertWithinPolicyWindow(compareWindow);
      const dataIssues: string[] = [];
      const sharedFilters = {
        tenantId,
        stationIds,
        fleetIds,
        regionIds,
        dateFromIso: '',
        dateToIso: '',
      };
      const [
        taskRows,
        schedulingRows,
        certificationRows,
        auditRows,
        forecastRows,
        telemetryRows,
      ] = await Promise.all([
        fetchScopedRows('task_execution_status', tenantId, 400, dataIssues),
        fetchScopedRows('scheduling_board_data', tenantId, 200, dataIssues),
        fetchScopedRows('certification_records', tenantId, 200, dataIssues),
        fetchScopedRows('audit_trails', tenantId, 300, dataIssues),
        fetchScopedRows('forecast_recommendations', tenantId, 200, dataIssues),
        fetchScopedRows('amro_operational_telemetry', tenantId, 1500, dataIssues),
      ]);

      const scopedTaskRows = filterRowsByScope(taskRows, sharedFilters);
      const scopedSchedulingRows = filterRowsByScope(schedulingRows, sharedFilters);
      const scopedCertificationRows = filterRowsByScope(certificationRows, sharedFilters);
      const scopedAuditRows = filterRowsByScope(auditRows, sharedFilters);
      const scopedForecastRows = filterRowsByScope(forecastRows, sharedFilters);
      const telemetryWindowRangeStart = new Date();
      telemetryWindowRangeStart.setDate(telemetryWindowRangeStart.getDate() - (window === '7d' ? 7 : window === '90d' ? 90 : 30));
      const scopedTelemetryRows = telemetryRows.filter((row) => {
        const recordedAt = parseDateMs(getStringValue(row, ['recorded_at', 'created_at']));
        return Number.isFinite(recordedAt) && recordedAt >= telemetryWindowRangeStart.getTime();
      });
      const timeSeries = scopedTaskRows.length > 0
        ? buildTrendSeriesFromTasks(scopedTaskRows, window)
        : buildTrendSeriesFromTelemetry(scopedTelemetryRows, window);
      const baseline = Math.round(timeSeries.reduce((sum, point) => sum + point.value, 0) / Math.max(1, timeSeries.length));
      const variance = Math.round((timeSeries[timeSeries.length - 1].value - baseline) * 100) / 100;
      const taskExecution = mapTaskExecutionMonitor(scopedTaskRows);
      const schedulingSnapshot = mapSchedulingSnapshot(scopedSchedulingRows);
      const certificationQueue = mapCertificationQueue(scopedCertificationRows);
      const auditTimeline = mapAuditTimeline(scopedAuditRows);
      const scopedAuditTimeline = persona === 'management'
        ? auditTimeline
        : auditTimeline.map((item) => ({ ...item, actor: 'restricted' })).slice(0, 6);
      const forecast = scopedForecastRows.length > 0
        ? mapForecastRecommendations(scopedForecastRows)
        : mapForecastRecommendationsFromTelemetry(scopedTelemetryRows);
      const auditPaging = paginate(scopedAuditTimeline, page, pageSize);
      const certificationPaging = paginate(certificationQueue, page, pageSize);

      return res.status(200).json({
        version: 'v2',
        interface: 'load-operational-trends',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        scope,
        serviceBoundaries,
        input: {
          metric_key: metricKey,
          window,
          compare_window: compareWindow,
          station_ids: scopeStationIds,
          fleet_ids: scopeFleetIds,
          region_ids: scopeRegionIds,
          page,
          page_size: pageSize,
        },
        output: {
          time_series: timeSeries,
          variance,
          threshold_breaches: variance > 8
            ? [{ metric_key: metricKey, threshold: 8, observed: variance, level: 'warning' }]
            : [],
          task_execution_monitor: taskExecution,
          scheduling_board_snapshot: schedulingSnapshot,
          certification_decision_queue: certificationPaging.items,
          audit_timeline: auditPaging.items,
          forecast_recommendation_hub: forecast.items,
          pagination: {
            page,
            page_size: pageSize,
            audit_timeline_total_rows: scopedAuditTimeline.length,
            certification_queue_total_rows: certificationQueue.length,
          },
          role_scope: {
            persona,
            restricted_sections: persona === 'management' ? [] : ['audit_timeline.actor'],
          },
          data_issues: dataIssues,
        },
      });
    }

    if (req.method === 'POST' && interfaceName === 'export-kpi-snapshot') {
      enforceAnyPermission(auth.permissions || [], ['dashboards.manage', 'reports.manage']);
      const body = parseBody(req.body);
      const format = String(body.format || '').trim().toLowerCase();
      const dateRange = parseDateRange(body.date_range);
      const selectedWidgets = parseStringArray(body.selected_widgets).map((widget) => widget.trim().toLowerCase());
      const retentionDays = parseRetentionDays(body.retention_days);
      const storageTier = parseStorageTier(body.storage_tier);
      const workerSource = String(process.env.AMRO_ANALYTICS_EXPORT_WORKER_NAME || 'analytics-export-worker');
      const cleanupReport = await runArtifactCleanupSweep(tenantId);

      if (!ALLOWED_EXPORT_FORMATS.has(format)) {
        throw new Error('format must be csv, pdf, or xlsx');
      }
      const unsupportedWidget = selectedWidgets.find((widget) => !ALLOWED_WIDGETS.has(widget));
      if (unsupportedWidget) {
        throw new Error('selected_widgets contains unsupported widget');
      }
      if (selectedWidgets.length === 0) {
        throw new Error('selected_widgets must include at least one widget');
      }

      const maxExportRows = getMaxExportRows();
      const projectedRows = Math.max(1, selectedWidgets.length) * 1500;
      const rowCount = Math.min(projectedRows, maxExportRows);
      const nowIso = new Date().toISOString();
      const jobId = createRuntimeId(`${tenantId}-kpi-export`);
      const baseDownloadUrl = `/api/v2/amro/overview-kpi/download/${jobId}.${format}`;
      const job: ExportJobRecord = {
        id: jobId,
        tenant_id: tenantId,
        franchise_id: franchiseId,
        status: 'queued',
        progress_pct: 5,
        created_at: nowIso,
        started_at: nowIso,
        completed_at: null,
        payload: {
          interface: 'export-kpi-snapshot',
          format,
          date_range: dateRange,
          selected_widgets: selectedWidgets,
          projected_rows: projectedRows,
          exported_rows: rowCount,
          retention_days: retentionDays,
          storage_tier: storageTier,
          attempts: 0,
        },
        response_payload: {
          progress_pct: 5,
          download_url: baseDownloadUrl,
          status_history: [{ status: 'queued', at: nowIso }],
        },
        dependency_failures: {},
      };
      await persistIntegrationJobCreate(job, workerSource);
      job.status = 'running';
      job.progress_pct = 15;
      job.response_payload = {
        ...job.response_payload,
        progress_pct: 15,
        status_history: [...((job.response_payload.status_history as unknown[]) || []), { status: 'running', at: new Date().toISOString() }],
      };
      await persistIntegrationJobUpdate(job);

      const workerResult = await runWithResilience(
        'analytics_worker',
        async () => {
          if (parseBoolean(process.env.AMRO_EXPORT_FORCE_WORKER_FAILURE, false)) {
            throw new Error('Analytics export worker unavailable');
          }
          return {
            worker_job_id: createRuntimeId('worker-job'),
            status: 'processed',
            completion_pct: 55,
          };
        },
        (error) => ({
          worker_job_id: createRuntimeId('worker-fallback'),
          status: 'deferred',
          completion_pct: 35,
          fallback_reason: error.message,
        }),
      );
      if (workerResult.error_message) {
        job.dependency_failures.analytics_worker = workerResult.error_message;
      }
      job.progress_pct = Math.max(job.progress_pct, Number(workerResult.value.completion_pct || 35));
      job.response_payload = {
        ...job.response_payload,
        progress_pct: job.progress_pct,
        worker: {
          ...workerResult.value,
          attempts: workerResult.attempts,
          fallback_used: workerResult.fallback_used,
        },
      };
      await persistIntegrationJobUpdate(job);

      const storageResult = await runWithResilience(
        'object_storage',
        async () => {
          if (parseBoolean(process.env.AMRO_EXPORT_FORCE_STORAGE_FAILURE, false)) {
            throw new Error('Object storage unavailable');
          }
          const createdAt = new Date().toISOString();
          const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
          const baseSize = Math.max(64 * 1024, rowCount * 30);
          return {
            key: `amro/overview-exports/${tenantId}/${jobId}.${format}`,
            tier: storageTier,
            retention_days: retentionDays,
            created_at: createdAt,
            expires_at: expiresAt,
            size_bytes: baseSize,
            state: 'active',
          } as ExportArtifactRecord;
        },
        () => {
          const createdAt = new Date().toISOString();
          const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
          return {
            key: `amro/fallback-exports/${tenantId}/${jobId}.${format}`,
            tier: storageTier,
            retention_days: retentionDays,
            created_at: createdAt,
            expires_at: expiresAt,
            size_bytes: Math.max(32 * 1024, rowCount * 20),
            state: 'active',
          } as ExportArtifactRecord;
        },
      );
      if (storageResult.error_message) {
        job.dependency_failures.object_storage = storageResult.error_message;
      }
      job.progress_pct = Math.max(job.progress_pct, 80);
      job.response_payload = {
        ...job.response_payload,
        progress_pct: job.progress_pct,
        artifact: storageResult.value,
        storage_dependency: {
          attempts: storageResult.attempts,
          fallback_used: storageResult.fallback_used,
        },
      };
      await persistIntegrationJobUpdate(job);

      const signedDownloadResult = await runWithResilience(
        'signed_download',
        async () => {
          if (parseBoolean(process.env.AMRO_EXPORT_FORCE_SIGNED_URL_FAILURE, false)) {
            throw new Error('Signed URL service unavailable');
          }
          const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
          const token = Buffer.from(`${jobId}:${expiresAt}`).toString('base64url');
          return {
            signed_download_url: `${baseDownloadUrl}?token=${token}&expires_at=${encodeURIComponent(expiresAt)}`,
            expires_at: expiresAt,
          };
        },
        () => ({
          signed_download_url: baseDownloadUrl,
          expires_at: null,
        }),
      );
      if (signedDownloadResult.error_message) {
        job.dependency_failures.signed_download = signedDownloadResult.error_message;
      }

      job.status = 'succeeded';
      job.progress_pct = 100;
      job.completed_at = new Date().toISOString();
      job.payload.attempts = Number(workerResult.attempts + storageResult.attempts + signedDownloadResult.attempts);
      job.response_payload = {
        ...job.response_payload,
        progress_pct: 100,
        status_history: [...((job.response_payload.status_history as unknown[]) || []), { status: 'succeeded', at: job.completed_at }],
        download_url: baseDownloadUrl,
        signed_download_url: signedDownloadResult.value.signed_download_url,
        signed_download_expires_at: signedDownloadResult.value.expires_at,
        completed_at: job.completed_at,
      };
      await persistIntegrationJobUpdate(job);

      const jobs = await loadExportJobs(tenantId);
      const storageUsage = summarizeStorageUsage(jobs);
      const dependencyStatus = {
        analytics_worker: {
          state: workerResult.fallback_used ? 'degraded' : 'healthy',
          fallback_used: workerResult.fallback_used,
          attempts: workerResult.attempts,
        },
        object_storage: {
          state: storageResult.fallback_used ? 'degraded' : 'healthy',
          fallback_used: storageResult.fallback_used,
          attempts: storageResult.attempts,
        },
        signed_download: {
          state: signedDownloadResult.fallback_used ? 'degraded' : 'healthy',
          fallback_used: signedDownloadResult.fallback_used,
          attempts: signedDownloadResult.attempts,
        },
      };
      const jobInfo = {
        export_job_id: job.id,
        job_status: job.status,
        completion_pct: job.progress_pct,
        created_at: job.created_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
        download_url: String(job.response_payload.download_url || baseDownloadUrl),
        signed_download_url: String(job.response_payload.signed_download_url || baseDownloadUrl),
        artifact: job.response_payload.artifact,
      };

      return res.status(200).json({
        version: 'v2',
        interface: 'export-kpi-snapshot',
        correlationId: ctx.correlationId,
        compatMode: compatDecision.compatMode,
        scope,
        serviceBoundaries,
        input: {
          format,
          date_range: dateRange,
          selected_widgets: selectedWidgets,
          retention_days: retentionDays,
          storage_tier: storageTier,
        },
        output: jobInfo,
        policy: {
          row_cap: maxExportRows,
          projected_rows: projectedRows,
          exported_rows: rowCount,
          row_cap_applied: projectedRows > maxExportRows,
          retention_days: retentionDays,
          storage_tier: storageTier,
        },
        dependencies: dependencyStatus,
        lifecycle: {
          cleanup: cleanupReport,
          storage_usage: storageUsage,
          artifact_tiering: {
            hot_days: 30,
            warm_days: 60,
            cold_days: 90,
          },
        },
        monitoring: {
          export_success_rate_pct: computeExportSuccessRate(jobs),
          cache_metrics: (() => {
            const cacheKey = `${tenantId}:${franchiseId || 'global'}:overview_dashboard`;
            const cacheState = MEMORY_CACHE_STATE.get(cacheKey) || {
              cache_hits: 0,
              cache_misses: 0,
              last_source_change_ms: 0,
              last_refreshed_at: null,
              last_invalidated_at: null,
            };
            const totalCacheRequests = cacheState.cache_hits + cacheState.cache_misses;
            return {
              hit_count: cacheState.cache_hits,
              miss_count: cacheState.cache_misses,
              hit_ratio_pct: totalCacheRequests > 0 ? Math.round((cacheState.cache_hits / totalCacheRequests) * 10000) / 100 : 100,
            };
          })(),
        },
      });
    }

    return res.status(400).json({
      error: 'Unsupported interface. Use load-kpi-dashboard, load-operational-trends, export-kpi-snapshot, export-dependency-health, or load-export-monitoring-dashboard.',
      correlationId: ctx.correlationId,
      version: 'v2',
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
