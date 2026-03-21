import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useEffect, useMemo, useState } from 'react';

type RouteInventoryData = {
  generatedAt: string;
  featureFlag: {
    key: string;
    enabled: boolean;
  };
  featureFlagPlatform: {
    version: number;
    checksum: string;
    updatedAt: string;
    globalKillSwitch: boolean;
    modules: Array<{
      key: string;
      enabled: boolean;
      emergencyKillSwitch: boolean;
      rolloutPercent: number;
      tenantCohorts: number;
      franchiseCohorts: number;
    }>;
  };
  gateway: {
    globalRevertToLegacy: boolean;
    facadeEnabled: boolean;
    v2PrimaryEnabled: boolean;
    v2ShadowEnabled: boolean;
  };
  web: {
    appRoutes: string[];
    menuRoutes: string[];
  };
  api: {
    routes: string[];
  };
  counts: {
    appRoutes: number;
    menuRoutes: number;
    apiRoutes: number;
  };
};

type RouteInventoryApiResponse = {
  data?: RouteInventoryData;
  correlationId?: string;
};

type MonitoringBaselineData = {
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
  };
  businessKpis: Array<{
    key: string;
    label: string;
    value: number;
    unit: 'count' | 'percent' | 'minutes';
  }>;
  alerts: {
    legacyChannelsParallel: boolean;
    noisyAlertMitigation: {
      burnRateWindows: string[];
      activeWindow: string;
    };
    policies: Array<{
      key: string;
      signal: 'latency' | 'error_rate' | 'burn_rate' | 'availability';
      threshold: number;
      windowMinutes: number;
      burnRateWindow: string;
      legacyChannelParallel: boolean;
    }>;
  };
};

type MonitoringBaselineApiResponse = {
  data?: MonitoringBaselineData;
  correlationId?: string;
};

type VerticalModuleKey = 'module-crm' | 'module-logistics' | 'module-quotation' | 'module-finance';

type VerticalExtractionData = {
  moduleConfig: {
    moduleKey: VerticalModuleKey;
    extractionEnabled: boolean;
    aclLegacyPathEnabled: boolean;
    routePath: 'extracted' | 'acl-legacy';
    reason: 'extracted_enabled' | 'extracted_disabled' | 'rollback_toggle' | 'module_acl_disabled';
  };
  writePlan: {
    allowed: boolean;
    directWrite: boolean;
    writePath: 'direct' | 'acl-legacy-proxy' | 'blocked';
    tableName: string;
  };
  translationResult: Record<string, unknown> | null;
};

type VerticalExtractionApiResponse = {
  data?: VerticalExtractionData;
  correlationId?: string;
};

type DualRunShadowMode = {
  moduleKey: VerticalModuleKey;
  shadowReadsEnabled: boolean;
  shadowWritesEnabled: boolean;
  updatedAt: string;
};

type ReconciliationArtifact = {
  runId: string;
  moduleKey: VerticalModuleKey;
  entityKey: string;
  thresholdPercent: number;
  comparedRecords: number;
  mismatchRecords: number;
  diffRatePercent: number;
  withinThreshold: boolean;
  generatedAt: string;
};

type ReconciliationData = {
  mode: DualRunShadowMode;
  artifacts: ReconciliationArtifact[];
};

type ReconciliationApiResponse = {
  data?: ReconciliationData;
  correlationId?: string;
};

const compatibilityModes = [
  { mode: 'v1-pass', purpose: 'Legacy response contract for existing tenants' },
  { mode: 'v2-shadow', purpose: 'Dual-run comparison without changing client behavior' },
  { mode: 'v2-primary', purpose: 'Primary v2 response for approved tenant scopes' },
];

const verticalModules: Array<{ key: VerticalModuleKey; label: string }> = [
  { key: 'module-crm', label: 'CRM' },
  { key: 'module-logistics', label: 'Logistics' },
  { key: 'module-quotation', label: 'Quotation' },
  { key: 'module-finance', label: 'Finance' },
];

export default function MigrationBaselineDashboard() {
  const [inventory, setInventory] = useState<RouteInventoryData | null>(null);
  const [monitoring, setMonitoring] = useState<MonitoringBaselineData | null>(null);
  const [selectedModule, setSelectedModule] = useState<VerticalModuleKey>('module-crm');
  const [verticalExtraction, setVerticalExtraction] = useState<VerticalExtractionData | null>(null);
  const [reconciliationMode, setReconciliationMode] = useState<DualRunShadowMode | null>(null);
  const [reconciliationArtifacts, setReconciliationArtifacts] = useState<ReconciliationArtifact[]>([]);
  const [controlsLoading, setControlsLoading] = useState(false);
  const [controlsError, setControlsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [controlCorrelationId, setControlCorrelationId] = useState<string | null>(null);

  useEffect(() => {
    const loadBaseline = async () => {
      try {
        setLoading(true);
        setError(null);
        const [inventoryResponse, monitoringResponse, extractionResponse, reconciliationResponse] = await Promise.all([
          fetch('/api/v1/gateway/route-inventory', {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'application/json' },
          }),
          fetch('/api/v1/gateway/monitoring-baseline', {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'application/json' },
          }),
          fetch(`/api/v1/gateway/vertical-extraction?moduleKey=${selectedModule}`, {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'application/json' },
          }),
          fetch(`/api/v1/gateway/reconciliation-report?moduleKey=${selectedModule}`, {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'application/json' },
          }),
        ]);
        const inventoryPayload = (await inventoryResponse.json()) as RouteInventoryApiResponse;
        const monitoringPayload = (await monitoringResponse.json()) as MonitoringBaselineApiResponse;
        const extractionPayload = (await extractionResponse.json()) as VerticalExtractionApiResponse;
        const reconciliationPayload = (await reconciliationResponse.json()) as ReconciliationApiResponse;
        if (!inventoryResponse.ok || !inventoryPayload?.data) {
          const message = (inventoryPayload as any)?.error || 'Failed to load gateway route inventory';
          throw new Error(message);
        }
        if (!monitoringResponse.ok || !monitoringPayload?.data) {
          const message = (monitoringPayload as any)?.error || 'Failed to load gateway monitoring baseline';
          throw new Error(message);
        }
        setInventory(inventoryPayload.data);
        setMonitoring(monitoringPayload.data);
        setVerticalExtraction(extractionPayload.data || null);
        setReconciliationMode(reconciliationPayload.data?.mode || null);
        setReconciliationArtifacts(reconciliationPayload.data?.artifacts || []);
        setControlsError(null);
        setCorrelationId(inventoryPayload.correlationId || monitoringPayload.correlationId || null);
        setControlCorrelationId(extractionPayload.correlationId || reconciliationPayload.correlationId || null);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : 'Failed to load gateway route inventory';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadBaseline();
  }, [selectedModule]);

  const refreshOperationalCard = async () => {
    try {
      setControlsLoading(true);
      setControlsError(null);
      const [extractionResponse, reconciliationResponse] = await Promise.all([
        fetch(`/api/v1/gateway/vertical-extraction?moduleKey=${selectedModule}`, {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }),
        fetch(`/api/v1/gateway/reconciliation-report?moduleKey=${selectedModule}`, {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }),
      ]);
      const extractionPayload = (await extractionResponse.json()) as VerticalExtractionApiResponse;
      const reconciliationPayload = (await reconciliationResponse.json()) as ReconciliationApiResponse;
      if (!extractionResponse.ok || !extractionPayload.data) {
        throw new Error((extractionPayload as any)?.error || 'Failed to refresh vertical extraction state');
      }
      if (!reconciliationResponse.ok || !reconciliationPayload.data) {
        throw new Error((reconciliationPayload as any)?.error || 'Failed to refresh reconciliation state');
      }
      setVerticalExtraction(extractionPayload.data);
      setReconciliationMode(reconciliationPayload.data.mode);
      setReconciliationArtifacts(reconciliationPayload.data.artifacts);
      setControlCorrelationId(extractionPayload.correlationId || reconciliationPayload.correlationId || null);
    } catch (refreshError) {
      setControlsError(refreshError instanceof Error ? refreshError.message : 'Failed to refresh operational state');
    } finally {
      setControlsLoading(false);
    }
  };

  const updateRollback = async (rollbackToLegacy: boolean) => {
    try {
      setControlsLoading(true);
      setControlsError(null);
      const response = await fetch(`/api/v1/gateway/vertical-extraction?moduleKey=${selectedModule}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          moduleConfig: {
            moduleKey: selectedModule,
            rollbackToLegacy,
          },
        }),
      });
      const payload = (await response.json()) as VerticalExtractionApiResponse;
      if (!response.ok || !payload.data) {
        throw new Error((payload as any)?.error || 'Failed to update rollback state');
      }
      setVerticalExtraction(payload.data);
      setControlCorrelationId(payload.correlationId || null);
    } catch (updateError) {
      setControlsError(updateError instanceof Error ? updateError.message : 'Failed to update rollback state');
    } finally {
      setControlsLoading(false);
    }
  };

  const updateShadowMode = async (patch: Partial<Pick<DualRunShadowMode, 'shadowReadsEnabled' | 'shadowWritesEnabled'>>) => {
    try {
      setControlsLoading(true);
      setControlsError(null);
      const response = await fetch(`/api/v1/gateway/reconciliation-report?moduleKey=${selectedModule}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          moduleKey: selectedModule,
          shadowMode: {
            shadowReadsEnabled: patch.shadowReadsEnabled ?? reconciliationMode?.shadowReadsEnabled ?? true,
            shadowWritesEnabled: patch.shadowWritesEnabled ?? reconciliationMode?.shadowWritesEnabled ?? true,
          },
        }),
      });
      const payload = (await response.json()) as ReconciliationApiResponse;
      if (!response.ok || !payload.data) {
        throw new Error((payload as any)?.error || 'Failed to update shadow mode');
      }
      setReconciliationMode(payload.data.mode);
      setReconciliationArtifacts(payload.data.artifacts || []);
      setControlCorrelationId(payload.correlationId || null);
    } catch (updateError) {
      setControlsError(updateError instanceof Error ? updateError.message : 'Failed to update shadow mode');
    } finally {
      setControlsLoading(false);
    }
  };

  const baselineKpis = useMemo(() => {
    const appRoutes = inventory?.counts.appRoutes ?? 0;
    const menuRoutes = inventory?.counts.menuRoutes ?? 0;
    const apiRoutes = inventory?.counts.apiRoutes ?? 0;
    const p95Ms = monitoring?.goldenSignals.latency.p95Ms ?? 0;
    const p99Ms = monitoring?.goldenSignals.latency.p99Ms ?? 0;
    const errorBudget = monitoring?.goldenSignals.errorRate.errorBudgetRemainingPercent ?? 0;
    return [
      { label: 'App Routes', value: String(appRoutes), trend: appRoutes > 0 ? 'active' : 'idle' },
      { label: 'Menu Routes', value: String(menuRoutes), trend: menuRoutes > 0 ? 'active' : 'idle' },
      { label: 'API Routes', value: String(apiRoutes), trend: apiRoutes > 0 ? 'active' : 'idle' },
      { label: 'P95 Latency', value: `${p95Ms} ms`, trend: 'monitor' },
      { label: 'P99 Latency', value: `${p99Ms} ms`, trend: 'monitor' },
      { label: 'Error Budget', value: `${errorBudget}%`, trend: errorBudget > 20 ? 'stable' : 'risk' },
      { label: 'Route Inventory Flag', value: inventory?.featureFlag.enabled ? 'enabled' : 'disabled', trend: 'monitor' },
      { label: 'Gateway Facade', value: inventory?.gateway.facadeEnabled ? 'enabled' : 'disabled', trend: 'stable' },
      { label: 'Global Legacy Revert', value: inventory?.gateway.globalRevertToLegacy ? 'on' : 'off', trend: 'stable' },
    ];
  }, [inventory, monitoring]);

  const trendArtifacts = useMemo(() => {
    return [...reconciliationArtifacts]
      .sort((a, b) => a.generatedAt.localeCompare(b.generatedAt))
      .slice(-8);
  }, [reconciliationArtifacts]);

  const latestArtifact = trendArtifacts.length ? trendArtifacts[trendArtifacts.length - 1] : null;
  const readiness = latestArtifact
    ? latestArtifact.withinThreshold && latestArtifact.diffRatePercent <= latestArtifact.thresholdPercent
      ? 'ready'
      : 'hold'
    : 'pending';
  const rollbackActive = verticalExtraction?.moduleConfig.reason === 'rollback_toggle';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Migration Baseline Dashboard</h1>
            <p className="text-muted-foreground">
              Tracks gateway compatibility, dual-run baseline metrics, and contract stability for staged v2 rollout.
            </p>
          </div>
          <Badge variant="secondary">PR-1</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {baselineKpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{kpi.value}</div>
                <p className="text-xs text-muted-foreground capitalize">{kpi.trend}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Route Inventory Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <p className="text-sm text-muted-foreground">Loading gateway route inventory...</p> : null}
            {error ? <p className="text-sm text-destructive">Unable to load route inventory: {error}</p> : null}
            {!loading && !error && inventory ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Generated {new Date(inventory.generatedAt).toLocaleString()}</Badge>
                  {correlationId ? <Badge variant="outline">Correlation {correlationId}</Badge> : null}
                </div>
                <div className="text-sm text-muted-foreground">
                  Top API routes: {inventory.api.routes.slice(0, 8).join(', ') || 'none'}
                </div>
                <div className="text-sm text-muted-foreground">
                  Feature flag config v{inventory.featureFlagPlatform.version} · checksum {inventory.featureFlagPlatform.checksum.slice(0, 12)}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monitoring and Alert Baseline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <p className="text-sm text-muted-foreground">Loading SLO baseline...</p> : null}
            {!loading && !error && monitoring ? (
              <>
                <div className="text-sm text-muted-foreground">
                  Throughput {monitoring.goldenSignals.throughputRpm} rpm · Availability {monitoring.goldenSignals.availabilityPercent}%
                </div>
                <div className="text-sm text-muted-foreground">
                  Burn-rate windows: {monitoring.alerts.noisyAlertMitigation.burnRateWindows.join(', ')} · active {monitoring.alerts.noisyAlertMitigation.activeWindow}
                </div>
                <div className="text-sm text-muted-foreground">
                  Legacy alert channels parallel: {monitoring.alerts.legacyChannelsParallel ? 'enabled' : 'disabled'}
                </div>
                <div className="text-sm text-muted-foreground">
                  Business KPIs: {monitoring.businessKpis.map((item) => `${item.label} ${item.value}`).join(' · ')}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compatibility Modes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {compatibilityModes.map((item) => (
              <div key={item.mode} className="flex items-start justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0">
                <Badge variant="outline">{item.mode}</Badge>
                <p className="flex-1 text-sm text-muted-foreground">{item.purpose}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vertical Extraction Operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {verticalModules.map((module) => (
                <Button
                  key={module.key}
                  variant={selectedModule === module.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedModule(module.key)}
                  disabled={controlsLoading}
                >
                  {module.label}
                </Button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Rollback to ACL-backed legacy path</div>
                  <Switch
                    checked={rollbackActive}
                    onCheckedChange={(checked) => void updateRollback(checked)}
                    disabled={controlsLoading}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  Route path: {verticalExtraction?.moduleConfig.routePath || 'unknown'} · reason: {verticalExtraction?.moduleConfig.reason || 'n/a'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Cross-module writes: {verticalExtraction?.writePlan.writePath || 'n/a'}
                </div>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Shadow reads</div>
                  <Switch
                    checked={Boolean(reconciliationMode?.shadowReadsEnabled)}
                    onCheckedChange={(checked) => void updateShadowMode({ shadowReadsEnabled: checked })}
                    disabled={controlsLoading}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Shadow writes</div>
                  <Switch
                    checked={Boolean(reconciliationMode?.shadowWritesEnabled)}
                    onCheckedChange={(checked) => void updateShadowMode({ shadowWritesEnabled: checked })}
                    disabled={controlsLoading}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  Last update: {reconciliationMode ? new Date(reconciliationMode.updatedAt).toLocaleString() : 'n/a'}
                </div>
              </div>
            </div>

            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium">Diff-rate trend</div>
                <Badge variant={readiness === 'ready' ? 'secondary' : 'outline'}>
                  Cutover {readiness}
                </Badge>
              </div>
              {trendArtifacts.length ? (
                <div className="space-y-2">
                  <div className="flex h-16 items-end gap-1">
                    {trendArtifacts.map((item) => (
                      <div
                        key={item.runId}
                        className="min-w-0 flex-1 rounded-sm bg-primary/70"
                        style={{ height: `${Math.max(6, Math.min(100, item.diffRatePercent))}%` }}
                        title={`${new Date(item.generatedAt).toLocaleTimeString()} · ${item.diffRatePercent}%`}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Latest diff {latestArtifact?.diffRatePercent ?? 0}% · threshold {latestArtifact?.thresholdPercent ?? 0}% · mismatches {latestArtifact?.mismatchRecords ?? 0}/{latestArtifact?.comparedRecords ?? 0}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No reconciliation artifacts yet for this module.</div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void refreshOperationalCard()} disabled={controlsLoading}>
                Refresh Operational State
              </Button>
              {controlCorrelationId ? <Badge variant="outline">Correlation {controlCorrelationId}</Badge> : null}
              {controlsLoading ? <Badge variant="outline">Updating</Badge> : null}
            </div>
            {controlsError ? <p className="text-sm text-destructive">Operational controls error: {controlsError}</p> : null}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
