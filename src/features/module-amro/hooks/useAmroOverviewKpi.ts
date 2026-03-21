import { useCallback, useEffect, useMemo, useState } from 'react';
import { AMRO_OVERVIEW_KPI_PATH } from '@/pages/api/v2/amro/integration-contracts';

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
  kpi_cards: KpiCard[];
  risk_heatmap: { cells: RiskHeatmapCell[] };
  trend_lines: TrendSeries[];
  anomaly_flags: AnomalyFlag[];
  freshness_warning?: string | null;
};

type TrendOutput = {
  time_series: TrendPoint[];
  variance: number;
  threshold_breaches: Array<{ metric_key: string; threshold: number; observed: number; level: string }>;
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

const DEFAULT_STATION_IDS = ['station-a'];
const DEFAULT_FLEET_IDS = ['fleet-a'];
const DEFAULT_WIDGETS = ['kpi_cards', 'risk_heatmap', 'trend_lines', 'anomaly_flags'];

function buildIsoRange(days: number): string {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return `${start.toISOString()}|${end.toISOString()}`;
}

async function requestOverview<TOutput>(url: string, init?: RequestInit): Promise<TOutput> {
  const response = await fetch(url, init);
  const payload = await response.json() as ApiEnvelope<TOutput>;
  if (!response.ok || payload.error) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }
  if (!payload.output) {
    throw new Error('Missing output payload');
  }
  return payload.output;
}

export function useAmroOverviewKpi() {
  const [dashboard, setDashboard] = useState<DashboardOutput | null>(null);
  const [trends, setTrends] = useState<TrendOutput | null>(null);
  const [lastExport, setLastExport] = useState<ExportOutput | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (request: DashboardRequest) => {
    const params = new URLSearchParams({
      interface: 'load-kpi-dashboard',
      date_range: request.dateRange,
      station_ids: (request.stationIds || DEFAULT_STATION_IDS).join(','),
      fleet_ids: (request.fleetIds || DEFAULT_FLEET_IDS).join(','),
      regulator_profile: request.regulatorProfile || 'FAA',
    });
    const output = await requestOverview<DashboardOutput>(`${AMRO_OVERVIEW_KPI_PATH}?${params.toString()}`);
    setDashboard(output);
    return output;
  }, []);

  const loadTrends = useCallback(async (request: TrendsRequest) => {
    const params = new URLSearchParams({
      interface: 'load-operational-trends',
      metric_key: request.metricKey,
      window: request.window,
      compare_window: request.compareWindow,
    });
    const output = await requestOverview<TrendOutput>(`${AMRO_OVERVIEW_KPI_PATH}?${params.toString()}`);
    setTrends(output);
    return output;
  }, []);

  const exportSnapshot = useCallback(async (request?: Partial<ExportRequest>) => {
    setExporting(true);
    setError(null);
    try {
      const output = await requestOverview<ExportOutput>(`${AMRO_OVERVIEW_KPI_PATH}?interface=export-kpi-snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: request?.format || 'pdf',
          date_range: request?.dateRange || buildIsoRange(30),
          selected_widgets: request?.selectedWidgets || DEFAULT_WIDGETS,
        }),
      });
      setLastExport(output);
      return output;
    } finally {
      setExporting(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([
          loadDashboard({ dateRange: buildIsoRange(30) }),
          loadTrends({ metricKey: 'schedule_adherence', window: '30d', compareWindow: '30d' }),
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

  const state = useMemo(() => ({
    dashboard,
    trends,
    lastExport,
    loading,
    exporting,
    error,
    loadDashboard,
    loadTrends,
    exportSnapshot,
  }), [dashboard, trends, lastExport, loading, exporting, error, loadDashboard, loadTrends, exportSnapshot]);

  return state;
}
