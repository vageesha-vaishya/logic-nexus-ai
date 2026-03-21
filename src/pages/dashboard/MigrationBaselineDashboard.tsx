import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const baselineKpis = [
  { label: 'P95 Latency (v1)', value: '420ms', trend: 'stable' },
  { label: 'P95 Latency (v2)', value: '438ms', trend: 'monitor' },
  { label: 'Error Rate (v1)', value: '0.31%', trend: 'stable' },
  { label: 'Error Rate (v2)', value: '0.34%', trend: 'monitor' },
  { label: 'Shadow Delta', value: '1.8%', trend: 'monitor' },
  { label: 'Contract Drift', value: '0', trend: 'stable' },
];

const compatibilityModes = [
  { mode: 'v1-pass', purpose: 'Legacy response contract for existing tenants' },
  { mode: 'v2-shadow', purpose: 'Dual-run comparison without changing client behavior' },
  { mode: 'v2-primary', purpose: 'Primary v2 response for approved tenant scopes' },
];

export default function MigrationBaselineDashboard() {
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
      </div>
    </DashboardLayout>
  );
}
