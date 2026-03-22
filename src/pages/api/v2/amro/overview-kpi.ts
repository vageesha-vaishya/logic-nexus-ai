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
  resolveAndApplyAccessContext,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../_utils/compatibility-facade';
import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';
import { buildAmroServiceBoundaryEnvelope, createAmroIsolationScope } from './anti-corruption-adapter';
import { enforceAmroSequentialMilestoneForOverviewKpiInterface } from './phase-plan-model';

type KpiWindow = '7d' | '30d' | '90d';
type JsonRecord = Record<string, unknown>;

const ALLOWED_METRIC_KEYS = new Set([
  'open_work_packages',
  'schedule_adherence',
  'aog_count',
  'compliance_risk',
  'parts_fill_rate',
]);
const ALLOWED_WINDOWS = new Set<KpiWindow>(['7d', '30d', '90d']);
const ALLOWED_EXPORT_FORMATS = new Set(['csv', 'pdf']);
const ALLOWED_WIDGETS = new Set(['kpi_cards', 'risk_heatmap', 'trend_lines', 'anomaly_flags']);
const KPI_CACHE_STALE_THRESHOLD_SECONDS = Number(process.env.AMRO_KPI_CACHE_STALE_SECONDS || 900);

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
  return getStringValue(row, ['status', 'state', 'workflow_state', 'execution_status']).toLowerCase();
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

async function fetchScopedRows(
  table: string,
  tenantId: string,
  limit: number,
  issueCollector: string[],
): Promise<JsonRecord[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('tenant_id', tenantId)
      .limit(limit);

    if (error) {
      issueCollector.push(`${table}: ${error.message}`);
      return [];
    }
    if (!Array.isArray(data)) {
      return [];
    }
    return data as JsonRecord[];
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
    const plannerId = getStringValue(row, ['planner_id', 'assigned_planner_id']);
    const engineerId = getStringValue(row, ['engineer_id', 'assigned_engineer_id']);
    const plannerPass = !plannerFilter || plannerId === plannerFilter;
    const engineerPass = !engineerFilter || engineerId === engineerFilter;
    return plannerPass && engineerPass;
  });
  return filtered.slice(0, 15).map((row) => ({
    work_package_id: getStringValue(row, ['id', 'work_package_id', 'code'], 'unknown-work-package'),
    title: getStringValue(row, ['title', 'name', 'description'], 'Untitled work package'),
    status: resolveStatus(row) || 'unknown',
    planner_id: getStringValue(row, ['planner_id', 'assigned_planner_id'], 'unassigned'),
    engineer_id: getStringValue(row, ['engineer_id', 'assigned_engineer_id'], 'unassigned'),
    due_at: getStringValue(row, ['due_at', 'planned_end_at', 'target_end_at'], ''),
    progress_pct: Math.round(normalizePercent(getNumericValue(row, ['progress_pct', 'completion_pct'], 0))),
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
      const reserved = getNumericValue(row, ['reserved_qty', 'quantity_reserved'], 0);
      const reorderPoint = getNumericValue(row, ['reorder_point', 'minimum_qty'], 0);
      const shortage = Math.max(0, Math.max(reserved - available, reorderPoint - available));
      return {
        part_number: getStringValue(row, ['part_number', 'sku', 'material_code'], 'unknown-part'),
        location: getStringValue(row, ['station_id', 'warehouse_id', 'location'], 'unknown-location'),
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
    const scopeStationIds = stationIds.map((id) => `${tenantId}:${id}`);
    const scopeFleetIds = fleetIds.map((id) => `${tenantId}:${id}`);
    const plannerId = String(req.query.planner_id || '').trim() || null;
    const engineerId = String(req.query.engineer_id || '').trim() || null;

    if (req.method === 'GET' && interfaceName === 'load-kpi-dashboard') {
      const dateRange = parseDateRange(req.query.date_range);
      const regulatorProfile = String(req.query.regulator_profile || '').trim() || 'default';
      const cacheAgeSeconds = Math.max(0, Number(req.query.cache_age_seconds || process.env.AMRO_KPI_CACHE_AGE_SECONDS || 120));
      const freshnessWarning = cacheAgeSeconds > KPI_CACHE_STALE_THRESHOLD_SECONDS
        ? 'Data may be stale; cache age exceeded freshness threshold'
        : null;
      const dataIssues: string[] = [];

      const [
        workPackageRows,
        materialsRows,
        complianceRows,
        integrationRows,
        forecastRows,
      ] = await Promise.all([
        fetchScopedRows('work_package_master', tenantId, 200, dataIssues),
        fetchScopedRows('materials_inventory', tenantId, 200, dataIssues),
        fetchScopedRows('compliance_gates', tenantId, 200, dataIssues),
        fetchScopedRows('integration_logs', tenantId, 200, dataIssues),
        fetchScopedRows('forecast_recommendations', tenantId, 200, dataIssues),
      ]);

      const now = Date.now();
      const activeWorkPackages = workPackageRows.filter((row) => !isResolvedStatus(resolveStatus(row))).length;
      const overdueTasksApprox = workPackageRows.filter((row) => {
        const dueMs = parseDateMs(getStringValue(row, ['due_at', 'planned_end_at', 'target_end_at']));
        const status = resolveStatus(row);
        return Number.isFinite(dueMs) && dueMs < now && !isResolvedStatus(status);
      }).length;
      const compliancePassed = complianceRows.filter((row) => ['passed', 'approved', 'resolved'].includes(resolveStatus(row))).length;
      const compliancePct = complianceRows.length ? (compliancePassed / complianceRows.length) * 100 : 0;
      const forecast = mapForecastRecommendations(forecastRows);
      const workPackageOverview = mapWorkPackageOverview(workPackageRows, plannerId, engineerId);
      const materialsAlerts = mapMaterialsAlerts(materialsRows);
      const complianceAttention = mapComplianceAttention(complianceRows);
      const integrationMonitor = mapIntegrationMonitor(integrationRows);
      const riskHeatmapCells = complianceAttention.slice(0, 8).map((item, index) => ({
        station: workPackageOverview[index]?.planner_id || scopeStationIds[index] || `${tenantId}:station-${index + 1}`,
        severity: item.status === 'failed' ? 'high' : item.status === 'blocked' ? 'medium' : 'low',
        score: item.status === 'failed' ? 90 : item.status === 'blocked' ? 65 : 30,
      }));

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
          regulator_profile: regulatorProfile,
          planner_id: plannerId,
          engineer_id: engineerId,
        },
        output: {
          executive_summary: {
            active_work_packages: activeWorkPackages,
            overdue_tasks: overdueTasksApprox,
            compliance_status_pct: Math.round(compliancePct * 10) / 10,
            forecast_accuracy_pct: forecast.forecast_accuracy_pct,
          },
          kpi_cards: [
            { key: 'open_work_packages', label: 'Open Work Packages', value: activeWorkPackages, trend: activeWorkPackages > 0 ? '+2%' : '0%' },
            { key: 'overdue_tasks', label: 'Overdue Tasks', value: overdueTasksApprox, trend: overdueTasksApprox > 0 ? '+1%' : '0%' },
            { key: 'compliance_status_pct', label: 'Compliance Status %', value: Math.round(compliancePct * 10) / 10, trend: compliancePct >= 95 ? '+0.5%' : '-0.8%' },
            { key: 'forecast_accuracy_pct', label: 'Forecast Accuracy %', value: forecast.forecast_accuracy_pct, trend: forecast.forecast_accuracy_pct >= 90 ? '+1.2%' : '-0.4%' },
          ],
          risk_heatmap: {
            cells: riskHeatmapCells,
          },
          trend_lines: [
            { metric_key: 'open_work_packages', points: generateTimeSeries('30d').map((point) => ({ ...point, value: Math.max(0, activeWorkPackages + point.value % 4) })) },
            { metric_key: 'compliance_status_pct', points: generateTimeSeries('30d').map((point) => ({ ...point, value: Math.max(0, Math.min(100, Math.round(compliancePct + (point.value % 5) - 2))) })) },
          ],
          anomaly_flags: integrationMonitor.recent_failures.slice(0, 3).map((failure, index) => ({
            id: `${tenantId}-anomaly-${index + 1}`,
            metric_key: 'integration_failures',
            severity: failure.status === 'timeout' ? 'medium' : 'high',
            message: failure.error_message || `Integration ${failure.integration_id} reported ${failure.status}`,
          })),
          work_package_overview: workPackageOverview,
          materials_reservation_alerts: materialsAlerts,
          compliance_gate_status: complianceAttention,
          integration_monitor: integrationMonitor,
          screen_modules: {
            total_modules: 12,
            management_and_planner_landing: true,
          },
          data_issues: dataIssues,
          freshness_warning: freshnessWarning,
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
      const [
        taskRows,
        schedulingRows,
        certificationRows,
        auditRows,
        forecastRows,
      ] = await Promise.all([
        fetchScopedRows('task_execution_status', tenantId, 400, dataIssues),
        fetchScopedRows('scheduling_board_data', tenantId, 200, dataIssues),
        fetchScopedRows('certification_records', tenantId, 200, dataIssues),
        fetchScopedRows('audit_trails', tenantId, 300, dataIssues),
        fetchScopedRows('forecast_recommendations', tenantId, 200, dataIssues),
      ]);

      const timeSeries = buildTrendSeriesFromTasks(taskRows, window);
      const baseline = Math.round(timeSeries.reduce((sum, point) => sum + point.value, 0) / Math.max(1, timeSeries.length));
      const variance = Math.round((timeSeries[timeSeries.length - 1].value - baseline) * 100) / 100;
      const taskExecution = mapTaskExecutionMonitor(taskRows);
      const schedulingSnapshot = mapSchedulingSnapshot(schedulingRows);
      const certificationQueue = mapCertificationQueue(certificationRows);
      const auditTimeline = mapAuditTimeline(auditRows);
      const forecast = mapForecastRecommendations(forecastRows);

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
        },
        output: {
          time_series: timeSeries,
          variance,
          threshold_breaches: variance > 8
            ? [{ metric_key: metricKey, threshold: 8, observed: variance, level: 'warning' }]
            : [],
          task_execution_monitor: taskExecution,
          scheduling_board_snapshot: schedulingSnapshot,
          certification_decision_queue: certificationQueue,
          audit_timeline: auditTimeline,
          forecast_recommendation_hub: forecast.items,
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

      if (!ALLOWED_EXPORT_FORMATS.has(format)) {
        throw new Error('format must be csv or pdf');
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
        },
        output: {
          export_job_id: `${tenantId}-kpi-export-${Date.now()}`,
          download_url: `/api/v2/amro/overview-kpi/download/${tenantId}-${Date.now()}.${format}`,
          generated_at: new Date().toISOString(),
        },
        policy: {
          row_cap: maxExportRows,
          projected_rows: projectedRows,
          exported_rows: rowCount,
          row_cap_applied: projectedRows > maxExportRows,
        },
      });
    }

    return res.status(400).json({
      error: 'Unsupported interface. Use load-kpi-dashboard, load-operational-trends, or export-kpi-snapshot.',
      correlationId: ctx.correlationId,
      version: 'v2',
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
