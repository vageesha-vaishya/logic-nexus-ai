import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AMRO_OVERVIEW_KPI_PATH } from '@/pages/api/v2/amro/integration-contracts';
import { supabase } from '@/integrations/supabase/client';

type KpiCard = {
  key: string;
  label: string;
  value: number;
  trend: string;
};

type RiskHeatmapCell = {
  station: string;
  severity: string;
  score: number;
};

type TrendPoint = {
  date: string;
  value: number;
};

type TrendSeries = {
  metric_key: string;
  points: TrendPoint[];
};

type AnomalyFlag = {
  id: string;
  metric_key: string;
  severity: string;
  message: string;
};

type DashboardOutput = {
  executive_summary: {
    active_work_packages: number;
    overdue_tasks: number;
    compliance_status_pct: number;
    forecast_accuracy_pct: number;
  };
  kpi_cards: KpiCard[];
  risk_heatmap: { cells: RiskHeatmapCell[] };
  trend_lines: TrendSeries[];
  anomaly_flags: AnomalyFlag[];
  work_package_overview: Array<{
    work_package_id: string;
    title: string;
    status: string;
    planner_id: string;
    engineer_id: string;
    due_at: string;
    progress_pct: number;
  }>;
  materials_reservation_alerts: Array<{
    part_number: string;
    location: string;
    available_qty: number;
    reserved_qty: number;
    shortage_qty: number;
  }>;
  compliance_gate_status: Array<{
    gate_id: string;
    gate_name: string;
    status: string;
    due_at: string;
    owner_id: string;
  }>;
  integration_monitor: {
    status: string;
    failed_attempts: number;
    failure_rate_pct: number;
    recent_failures: Array<{
      integration_id: string;
      status: string;
      direction: string;
      last_attempt_at: string;
      error_message: string;
    }>;
  };
  screen_modules: {
    total_modules: number;
    management_and_planner_landing: boolean;
  };
  data_issues?: string[];
  freshness_warning?: string | null;
};

type TrendOutput = {
  time_series: TrendPoint[];
  variance: number;
  threshold_breaches: Array<{ metric_key: string; threshold: number; observed: number; level: string }>;
  task_execution_monitor: {
    technician_count: number;
    completed_tasks: number;
    average_productivity_pct: number;
    mobile_completion_rate_pct: number;
  };
  scheduling_board_snapshot: {
    upcoming_slots: Array<{
      slot_id: string;
      station: string;
      start_at: string;
      end_at: string;
      resource: string;
      utilization_pct: number;
    }>;
    resource_utilization_pct: number;
  };
  certification_decision_queue: Array<{
    certification_id: string;
    work_package_id: string;
    authority: string;
    status: string;
    submitted_at: string;
  }>;
  audit_timeline: Array<{
    event_id: string;
    action: string;
    actor: string;
    created_at: string;
    outcome: string;
  }>;
  forecast_recommendation_hub: Array<{
    recommendation_id: string;
    work_package_id: string;
    recommendation: string;
    confidence_pct: number;
    risk_score: number;
    reason: string;
  }>;
  data_issues?: string[];
};

type ExportOutput = {
  export_job_id: string;
  download_url: string;
  generated_at: string;
};

type DashboardRequest = {
  dateRange: string;
  stationIds?: string[];
  fleetIds?: string[];
  regulatorProfile?: string;
  plannerId?: string;
  engineerId?: string;
};

type TrendsRequest = {
  metricKey: string;
  window: '7d' | '30d' | '90d';
  compareWindow: string;
};

type ExportRequest = {
  format: 'csv' | 'pdf';
  dateRange: string;
  selectedWidgets: string[];
};

type ApiEnvelope<TOutput> = {
  output?: TOutput;
  error?: string;
};

type AmroRequestScope = {
  tenantId?: string | null;
  franchiseId?: string | null;
  userId?: string | null;
  domainCode?: string | null;
};

const DEFAULT_STATION_IDS = ['station-a'];
const DEFAULT_FLEET_IDS = ['fleet-a'];
const DEFAULT_WIDGETS = ['kpi_cards', 'risk_heatmap', 'trend_lines', 'anomaly_flags'];
const DEFAULT_DASHBOARD_REQUEST: DashboardRequest = {
  dateRange: buildIsoRange(30),
};
const DEFAULT_TRENDS_REQUEST: TrendsRequest = {
  metricKey: 'schedule_adherence',
  window: '30d',
  compareWindow: '30d',
};
const CRITICAL_REFRESH_MS = 30_000;
const STANDARD_REFRESH_MS = 300_000;
const API_UNAVAILABLE_RETRY_MS = 30_000;
const API_UNAVAILABLE_MESSAGE = 'AMRO API is temporarily unavailable. Retrying shortly.';
const CRITICAL_METRIC_KEYS = new Set(['overdue_tasks', 'compliance_status_pct', 'integration_failures', 'aog_count']);
const KPI_FALLBACK_DATA_ISSUE = 'Live AMRO KPI API is unavailable. Showing scoped fallback snapshot.';
const TRENDS_FALLBACK_DATA_ISSUE = 'Live AMRO trends API is unavailable. Showing fallback trend telemetry.';
let globalApiUnavailableUntil = 0;

export function __resetAmroOverviewKpiCooldownForTests() {
  globalApiUnavailableUntil = 0;
}

function buildIsoRange(days: number): string {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return `${start.toISOString()}|${end.toISOString()}`;
}

function isNetworkConnectivityError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const normalized = error.message.toLowerCase();
  return normalized.includes('failed to fetch') || normalized.includes('networkerror') || normalized.includes('econnrefused');
}

function isSessionAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const normalized = error.message.toLowerCase();
  return normalized.includes('unauthorized') || normalized.includes('missing active session token');
}

function buildFallbackDashboard(request: DashboardRequest): DashboardOutput {
  return {
    executive_summary: {
      active_work_packages: 0,
      overdue_tasks: 0,
      compliance_status_pct: 0,
      forecast_accuracy_pct: 0,
    },
    kpi_cards: [
      { key: 'open_work_packages', label: 'Open Work Packages', value: 0, trend: 'N/A' },
      { key: 'overdue_tasks', label: 'Overdue Tasks', value: 0, trend: 'N/A' },
      { key: 'compliance_risk', label: 'Compliance Risk', value: 0, trend: 'N/A' },
      { key: 'aog_count', label: 'AOG Count', value: 0, trend: 'N/A' },
    ],
    risk_heatmap: { cells: [] },
    trend_lines: [],
    anomaly_flags: [],
    work_package_overview: [],
    materials_reservation_alerts: [],
    compliance_gate_status: [],
    integration_monitor: {
      status: 'degraded',
      failed_attempts: 0,
      failure_rate_pct: 100,
      recent_failures: [],
    },
    screen_modules: {
      total_modules: 1,
      management_and_planner_landing: true,
    },
    data_issues: [
      KPI_FALLBACK_DATA_ISSUE,
      `Scope: ${(request.stationIds || DEFAULT_STATION_IDS).join(',')} / ${(request.fleetIds || DEFAULT_FLEET_IDS).join(',')}`,
    ],
    freshness_warning: API_UNAVAILABLE_MESSAGE,
  };
}

function buildFallbackTrends(): TrendOutput {
  return {
    time_series: [],
    variance: 0,
    threshold_breaches: [],
    task_execution_monitor: {
      technician_count: 0,
      completed_tasks: 0,
      average_productivity_pct: 0,
      mobile_completion_rate_pct: 0,
    },
    scheduling_board_snapshot: {
      upcoming_slots: [],
      resource_utilization_pct: 0,
    },
    certification_decision_queue: [],
    audit_timeline: [],
    forecast_recommendation_hub: [],
    data_issues: [TRENDS_FALLBACK_DATA_ISSUE],
  };
}

async function requestOverview<TOutput>(url: string, init: RequestInit | undefined, scope: AmroRequestScope): Promise<TOutput> {
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData?.session?.access_token || '';
  if (!token) {
    const { data: refreshData } = await supabase.auth.refreshSession();
    token = refreshData?.session?.access_token || '';
  }

  if (!token) {
    throw new Error('Unauthorized: missing active session token');
  }

  const buildRequestHeaders = () => {
    const headers = new Headers(init?.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    if (scope.tenantId) {
      headers.set('x-tenant-id', scope.tenantId);
    }
    if (scope.franchiseId) {
      headers.set('x-franchise-id', scope.franchiseId);
    }
    if (scope.userId) {
      headers.set('x-user-id', scope.userId);
    }
    if (scope.domainCode) {
      headers.set('x-domain-id', scope.domainCode);
    }
    return headers;
  };

  const parseEnvelope = async (response: Response): Promise<ApiEnvelope<TOutput>> => {
    if (typeof response.text === 'function') {
      const raw = await response.text();
      if (!raw.trim()) {
        return {};
      }
      try {
        return JSON.parse(raw) as ApiEnvelope<TOutput>;
      } catch {
        throw new Error('Invalid JSON response payload');
      }
    }
    if (typeof response.json === 'function') {
      try {
        return await response.json() as ApiEnvelope<TOutput>;
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (/unexpected end of json input/i.test(message)) {
          return {};
        }
        throw error;
      }
    }
    return {};
  };

  const callWithToken = async (requestUrl: string) => {
    const response = await fetch(requestUrl, {
      ...init,
      headers: buildRequestHeaders(),
    });
    const payload = await parseEnvelope(response);
    return { response, payload };
  };

  let activeUrl = url;
  let { response, payload } = await callWithToken(activeUrl);
  const isAuthHeaderRejection = response.status === 401
    && /missing or malformed authorization header/i.test(String(payload.error || ''));
  if (isAuthHeaderRejection) {
    const separator = url.includes('?') ? '&' : '?';
    const fallbackUrl = `${url}${separator}access_token=${encodeURIComponent(token)}`;
    const retried = await callWithToken(fallbackUrl);
    activeUrl = fallbackUrl;
    response = retried.response;
    payload = retried.payload;
  }
  if (response.ok && !payload.error && !payload.output) {
    const retried = await callWithToken(activeUrl);
    response = retried.response;
    payload = retried.payload;
  }

  if (!response.ok || payload.error) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }
  if (!payload.output) {
    throw new Error('Empty response payload from AMRO KPI API');
  }
  return payload.output;
}

export function useAmroOverviewKpi(scope: AmroRequestScope = {}) {
  const [dashboard, setDashboard] = useState<DashboardOutput | null>(null);
  const [trends, setTrends] = useState<TrendOutput | null>(null);
  const [lastExport, setLastExport] = useState<ExportOutput | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDashboardRefreshAt, setLastDashboardRefreshAt] = useState<string | null>(null);
  const [lastTrendsRefreshAt, setLastTrendsRefreshAt] = useState<string | null>(null);
  const dashboardRequestRef = useRef<DashboardRequest>(DEFAULT_DASHBOARD_REQUEST);
  const trendsRequestRef = useRef<TrendsRequest>(DEFAULT_TRENDS_REQUEST);
  const apiUnavailableUntilRef = useRef<number>(0);
  const isApiTemporarilyUnavailable = useCallback(
    () => Date.now() < Math.max(apiUnavailableUntilRef.current, globalApiUnavailableUntil),
    [],
  );
  const markApiTemporarilyUnavailable = useCallback(() => {
    const unavailableUntil = Date.now() + API_UNAVAILABLE_RETRY_MS;
    apiUnavailableUntilRef.current = unavailableUntil;
    globalApiUnavailableUntil = Math.max(globalApiUnavailableUntil, unavailableUntil);
  }, []);
  const normalizedScope = useMemo(
    () => ({
      tenantId: scope.tenantId?.trim() || undefined,
      franchiseId: scope.franchiseId?.trim() || undefined,
      userId: scope.userId?.trim() || undefined,
      domainCode: scope.domainCode?.trim() || undefined,
    }),
    [scope.domainCode, scope.franchiseId, scope.tenantId, scope.userId],
  );

  const loadDashboard = useCallback(async (request: DashboardRequest) => {
    dashboardRequestRef.current = request;
    if (isApiTemporarilyUnavailable()) {
      const fallback = buildFallbackDashboard(request);
      setDashboard(fallback);
      setLastDashboardRefreshAt(new Date().toISOString());
      return fallback;
    }
    const params = new URLSearchParams({
      interface: 'load-kpi-dashboard',
      date_range: request.dateRange,
      station_ids: (request.stationIds || DEFAULT_STATION_IDS).join(','),
      fleet_ids: (request.fleetIds || DEFAULT_FLEET_IDS).join(','),
      regulator_profile: request.regulatorProfile || 'FAA',
    });
    if (request.plannerId) {
      params.set('planner_id', request.plannerId);
    }
    if (request.engineerId) {
      params.set('engineer_id', request.engineerId);
    }
    let output: DashboardOutput;
    try {
      output = await requestOverview<DashboardOutput>(`${AMRO_OVERVIEW_KPI_PATH}?${params.toString()}`, undefined, normalizedScope);
    } catch (error) {
      if (isNetworkConnectivityError(error) || isSessionAuthError(error)) {
        markApiTemporarilyUnavailable();
        const fallback = buildFallbackDashboard(request);
        setDashboard(fallback);
        setLastDashboardRefreshAt(new Date().toISOString());
        return fallback;
      }
      throw error;
    }
    setDashboard(output);
    setLastDashboardRefreshAt(new Date().toISOString());
    return output;
  }, [isApiTemporarilyUnavailable, markApiTemporarilyUnavailable, normalizedScope]);

  const loadTrends = useCallback(async (request: TrendsRequest) => {
    trendsRequestRef.current = request;
    if (isApiTemporarilyUnavailable()) {
      const fallback = buildFallbackTrends();
      setTrends(fallback);
      setLastTrendsRefreshAt(new Date().toISOString());
      return fallback;
    }
    const params = new URLSearchParams({
      interface: 'load-operational-trends',
      metric_key: request.metricKey,
      window: request.window,
      compare_window: request.compareWindow,
    });
    let output: TrendOutput;
    try {
      output = await requestOverview<TrendOutput>(`${AMRO_OVERVIEW_KPI_PATH}?${params.toString()}`, undefined, normalizedScope);
    } catch (error) {
      if (isNetworkConnectivityError(error) || isSessionAuthError(error)) {
        markApiTemporarilyUnavailable();
        const fallback = buildFallbackTrends();
        setTrends(fallback);
        setLastTrendsRefreshAt(new Date().toISOString());
        return fallback;
      }
      throw error;
    }
    setTrends(output);
    setLastTrendsRefreshAt(new Date().toISOString());
    return output;
  }, [isApiTemporarilyUnavailable, markApiTemporarilyUnavailable, normalizedScope]);

  const exportSnapshot = useCallback(async (request?: Partial<ExportRequest>) => {
    setExporting(true);
    setError(null);
    try {
      if (isApiTemporarilyUnavailable()) {
        throw new Error(API_UNAVAILABLE_MESSAGE);
      }
      let output: ExportOutput;
      try {
        output = await requestOverview<ExportOutput>(`${AMRO_OVERVIEW_KPI_PATH}?interface=export-kpi-snapshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            format: request?.format || 'pdf',
            date_range: request?.dateRange || buildIsoRange(30),
            selected_widgets: request?.selectedWidgets || DEFAULT_WIDGETS,
          }),
        }, normalizedScope);
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
          throw new Error(API_UNAVAILABLE_MESSAGE);
        }
        throw error;
      }
      setLastExport(output);
      return output;
    } finally {
      setExporting(false);
    }
  }, [isApiTemporarilyUnavailable, markApiTemporarilyUnavailable, normalizedScope]);

  const refreshAll = useCallback(async () => {
    setError(null);
    await Promise.all([
      loadDashboard(dashboardRequestRef.current),
      loadTrends(trendsRequestRef.current),
    ]);
  }, [loadDashboard, loadTrends]);

  const getMetricTier = useCallback((metricKey: string) => (
    CRITICAL_METRIC_KEYS.has(metricKey) ? 'critical' : 'standard'
  ), []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([
          loadDashboard(DEFAULT_DASHBOARD_REQUEST),
          loadTrends(DEFAULT_TRENDS_REQUEST),
        ]);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load AMRO KPI overview');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [loadDashboard, loadTrends]);

  useEffect(() => {
    const criticalRefreshId = window.setInterval(() => {
      if (isApiTemporarilyUnavailable()) {
        return;
      }
      void loadDashboard(dashboardRequestRef.current).catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to refresh AMRO KPI dashboard');
      });
    }, CRITICAL_REFRESH_MS);
    return () => {
      window.clearInterval(criticalRefreshId);
    };
  }, [isApiTemporarilyUnavailable, loadDashboard]);

  useEffect(() => {
    const standardRefreshId = window.setInterval(() => {
      if (isApiTemporarilyUnavailable()) {
        return;
      }
      void loadTrends(trendsRequestRef.current).catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to refresh AMRO operational trends');
      });
    }, STANDARD_REFRESH_MS);
    return () => {
      window.clearInterval(standardRefreshId);
    };
  }, [isApiTemporarilyUnavailable, loadTrends]);

  const state = useMemo(() => ({
    dashboard,
    trends,
    lastExport,
    loading,
    exporting,
    error,
    lastDashboardRefreshAt,
    lastTrendsRefreshAt,
    refreshCadence: {
      criticalMs: CRITICAL_REFRESH_MS,
      standardMs: STANDARD_REFRESH_MS,
    },
    getMetricTier,
    loadDashboard,
    loadTrends,
    refreshAll,
    exportSnapshot,
  }), [
    dashboard,
    trends,
    lastExport,
    loading,
    exporting,
    error,
    lastDashboardRefreshAt,
    lastTrendsRefreshAt,
    getMetricTier,
    loadDashboard,
    loadTrends,
    refreshAll,
    exportSnapshot,
  ]);

  return state;
}
