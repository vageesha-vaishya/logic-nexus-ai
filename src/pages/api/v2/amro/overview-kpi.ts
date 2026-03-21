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
import { buildAmroServiceBoundaryEnvelope, createAmroIsolationScope } from './anti-corruption-adapter';

type KpiWindow = '7d' | '30d' | '90d';

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
    const stationIds = sanitizeScopeFilters(parseStringArray(req.query.station_ids), 'station_ids');
    const fleetIds = sanitizeScopeFilters(parseStringArray(req.query.fleet_ids), 'fleet_ids');
    const scopeStationIds = stationIds.map((id) => `${tenantId}:${id}`);
    const scopeFleetIds = fleetIds.map((id) => `${tenantId}:${id}`);

    if (req.method === 'GET' && interfaceName === 'load-kpi-dashboard') {
      const dateRange = parseDateRange(req.query.date_range);
      const regulatorProfile = String(req.query.regulator_profile || '').trim() || 'default';
      const cacheAgeSeconds = Math.max(0, Number(req.query.cache_age_seconds || process.env.AMRO_KPI_CACHE_AGE_SECONDS || 120));
      const freshnessWarning = cacheAgeSeconds > KPI_CACHE_STALE_THRESHOLD_SECONDS
        ? 'Data may be stale; cache age exceeded freshness threshold'
        : null;

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
        },
        output: {
          kpi_cards: [
            { key: 'open_work_packages', label: 'Open Work Packages', value: 42, trend: '+6%' },
            { key: 'schedule_adherence', label: 'Schedule Adherence', value: 96.2, trend: '+1.2%' },
            { key: 'compliance_risk', label: 'Compliance Risk', value: 2, trend: '-18%' },
          ],
          risk_heatmap: {
            cells: [
              { station: scopeStationIds[0] || `${tenantId}:default-station`, severity: 'low', score: 18 },
              { station: scopeStationIds[1] || `${tenantId}:backup-station`, severity: 'medium', score: 41 },
            ],
          },
          trend_lines: [
            { metric_key: 'open_work_packages', points: generateTimeSeries('30d') },
            { metric_key: 'schedule_adherence', points: generateTimeSeries('30d') },
          ],
          anomaly_flags: [
            { id: `${tenantId}-anomaly-1`, metric_key: 'aog_count', severity: 'high', message: 'AOG spike above baseline' },
          ],
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

      const timeSeries = generateTimeSeries(window);
      const baseline = Math.round(timeSeries.reduce((sum, point) => sum + point.value, 0) / Math.max(1, timeSeries.length));
      const variance = Math.round((timeSeries[timeSeries.length - 1].value - baseline) * 100) / 100;

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
