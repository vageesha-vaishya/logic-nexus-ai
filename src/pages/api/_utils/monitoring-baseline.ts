import { getCompatibilityTransitionTelemetrySnapshot } from './compatibility-facade';
import { getGatewayFeatureFlagConfigSnapshot } from './gateway-feature-flags';

type GoldenSignalSeriesPoint = {
  bucket: string;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
  throughputRpm: number;
};

type AlertPolicy = {
  key: string;
  signal: 'latency' | 'error_rate' | 'burn_rate' | 'availability';
  threshold: number;
  windowMinutes: number;
  burnRateWindow: string;
  legacyChannelParallel: boolean;
};

type BusinessKpi = {
  key: string;
  label: string;
  value: number;
  unit: 'count' | 'percent' | 'minutes';
};

export type MonitoringBaselinePayload = {
  generatedAt: string;
  featureFlag: {
    key: string;
    enabled: boolean;
    configVersion: number;
    configChecksum: string;
  };
  goldenSignals: {
    latency: {
      p95Ms: number;
      p99Ms: number;
      objectiveMs: number;
    };
    errorRate: {
      value: number;
      objective: number;
      errorBudgetRemainingPercent: number;
    };
    throughputRpm: number;
    availabilityPercent: number;
    series: GoldenSignalSeriesPoint[];
  };
  businessKpis: BusinessKpi[];
  alerts: {
    legacyChannelsParallel: boolean;
    noisyAlertMitigation: {
      burnRateWindows: string[];
      activeWindow: string;
    };
    policies: AlertPolicy[];
  };
};

function parseBoolean(value: string | undefined, fallback = false): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === '1' || normalized === 'true' || normalized === 'on';
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(String(value || '').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBurnRateWindows(value: string | undefined): string[] {
  const raw = String(value || '5m,30m,2h,6h');
  const parsed = raw
    .split(',')
    .map((window) => window.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : ['5m', '30m', '2h', '6h'];
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildSeries(baseP95: number, baseP99: number, baseErrorRate: number, throughput: number): GoldenSignalSeriesPoint[] {
  const now = Date.now();
  return Array.from({ length: 6 }).map((_, index) => {
    const age = 5 - index;
    const timestamp = new Date(now - age * 5 * 60_000).toISOString();
    const multiplier = 1 + (index - 2) * 0.03;
    return {
      bucket: timestamp,
      p95Ms: Math.max(1, Math.round(baseP95 * multiplier)),
      p99Ms: Math.max(1, Math.round(baseP99 * multiplier)),
      errorRate: round(Math.max(0, baseErrorRate * (1 + (index - 2) * 0.06)), 4),
      throughputRpm: Math.max(1, Math.round(throughput * (1 + (2 - index) * 0.02))),
    };
  });
}

export function generateMonitoringBaselinePayload(): MonitoringBaselinePayload {
  const telemetry = getCompatibilityTransitionTelemetrySnapshot(500);
  const totalTransitions = telemetry.reduce((sum, item) => sum + item.count, 0);
  const rollbackTransitions = telemetry
    .filter((item) => item.reason === 'global_revert_toggle')
    .reduce((sum, item) => sum + item.count, 0);
  const rollbackRatio = totalTransitions > 0 ? rollbackTransitions / totalTransitions : 0;
  const p95ObjectiveMs = parseNumber(process.env.GATEWAY_SLO_P95_OBJECTIVE_MS, 450);
  const p99ObjectiveMs = parseNumber(process.env.GATEWAY_SLO_P99_OBJECTIVE_MS, 900);
  const p95Ms = Math.round(p95ObjectiveMs * (1 + rollbackRatio * 0.15));
  const p99Ms = Math.round(p99ObjectiveMs * (1 + rollbackRatio * 0.2));
  const errorRateObjective = parseNumber(process.env.GATEWAY_SLO_ERROR_RATE_OBJECTIVE, 0.01);
  const errorRate = round(Math.min(1, errorRateObjective + rollbackRatio * 0.01), 4);
  const errorBudgetRemainingPercent = round(Math.max(0, 100 - (errorRate / errorRateObjective) * 100), 2);
  const throughputRpm = Math.max(1, parseNumber(process.env.GATEWAY_SLO_THROUGHPUT_RPM, 1500) - rollbackTransitions * 3);
  const availabilityPercent = round(Math.max(99, 99.99 - rollbackRatio * 0.25), 3);

  const burnRateWindows = parseBurnRateWindows(process.env.GATEWAY_ALERT_BURN_RATE_WINDOWS);
  const activeBurnRateWindow = String(process.env.GATEWAY_ALERT_BURN_RATE_ACTIVE || burnRateWindows[1] || burnRateWindows[0]).trim();
  const legacyChannelsParallel = parseBoolean(process.env.GATEWAY_ALERT_LEGACY_CHANNELS_PARALLEL, true);
  const featureConfig = getGatewayFeatureFlagConfigSnapshot();

  return {
    generatedAt: new Date().toISOString(),
    featureFlag: {
      key: 'MIGRATION_BASELINE_SLO_V1',
      enabled: Boolean(featureConfig.modules['gateway.monitoring-baseline']?.enabled),
      configVersion: featureConfig.version,
      configChecksum: featureConfig.checksum,
    },
    goldenSignals: {
      latency: {
        p95Ms,
        p99Ms,
        objectiveMs: p95ObjectiveMs,
      },
      errorRate: {
        value: errorRate,
        objective: errorRateObjective,
        errorBudgetRemainingPercent,
      },
      throughputRpm,
      availabilityPercent,
      series: buildSeries(p95Ms, p99Ms, errorRate, throughputRpm),
    },
    businessKpis: [
      {
        key: 'gateway-routed-traffic',
        label: 'Gateway Routed Traffic',
        value: totalTransitions,
        unit: 'count',
      },
      {
        key: 'rollback-activations',
        label: 'Rollback Activations',
        value: rollbackTransitions,
        unit: 'count',
      },
      {
        key: 'dual-run-candidate-routes',
        label: 'Dual-Run Candidate Routes',
        value: telemetry.filter((item) => item.to.compatMode === 'v2-shadow').length,
        unit: 'count',
      },
      {
        key: 'error-budget-remaining',
        label: 'Error Budget Remaining',
        value: errorBudgetRemainingPercent,
        unit: 'percent',
      },
    ],
    alerts: {
      legacyChannelsParallel,
      noisyAlertMitigation: {
        burnRateWindows,
        activeWindow: activeBurnRateWindow,
      },
      policies: [
        {
          key: 'gateway-p95-latency',
          signal: 'latency',
          threshold: p95ObjectiveMs,
          windowMinutes: 5,
          burnRateWindow: activeBurnRateWindow,
          legacyChannelParallel: legacyChannelsParallel,
        },
        {
          key: 'gateway-p99-latency',
          signal: 'latency',
          threshold: p99ObjectiveMs,
          windowMinutes: 15,
          burnRateWindow: activeBurnRateWindow,
          legacyChannelParallel: legacyChannelsParallel,
        },
        {
          key: 'gateway-error-budget-burn',
          signal: 'burn_rate',
          threshold: 2,
          windowMinutes: 30,
          burnRateWindow: activeBurnRateWindow,
          legacyChannelParallel: legacyChannelsParallel,
        },
        {
          key: 'gateway-error-rate',
          signal: 'error_rate',
          threshold: errorRateObjective,
          windowMinutes: 10,
          burnRateWindow: activeBurnRateWindow,
          legacyChannelParallel: legacyChannelsParallel,
        },
      ],
    },
  };
}
