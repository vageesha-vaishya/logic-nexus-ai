import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { EnterpriseFeedRow, EnterpriseKpi, EnterpriseLane, EnterpriseProfile } from '@/hooks/useEnterpriseDashboardData';

type EnterpriseDashboardShellProps = {
  profile: EnterpriseProfile;
  compactDensity?: boolean;
  showAlerts?: boolean;
  heading: string;
  subheading: string;
  loading?: boolean;
  kpis: EnterpriseKpi[];
  lanes: EnterpriseLane[];
  activityRows: EnterpriseFeedRow[];
};

export function EnterpriseDashboardShell({
  profile,
  compactDensity = false,
  showAlerts = false,
  heading,
  subheading,
  loading = false,
  kpis,
  lanes,
  activityRows,
}: EnterpriseDashboardShellProps) {
  return (
    <div className={cn('space-y-6', compactDensity ? 'space-y-4' : 'space-y-6')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
          <p className="text-sm text-muted-foreground">{subheading}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{profile === 'operations' ? 'Operations Control' : 'Executive Performance'}</Badge>
          <Button size="sm">Create Action</Button>
        </div>
      </div>

      {showAlerts && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="py-3 text-sm">
            <span className="font-medium text-amber-800">Attention:</span>
            <span className="ml-2 text-amber-800">Critical records require exception handling in the next 30 minutes.</span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardDescription>{kpi.label}</CardDescription>
              <CardTitle className="text-2xl">{loading ? '...' : kpi.value}</CardTitle>
            </CardHeader>
            <CardContent className={cn('text-xs font-medium', kpi.tone)}>{kpi.delta} vs last period</CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Execution Board</CardTitle>
            <CardDescription>Operational lanes with capacity and SLA visibility</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lanes.map((lane) => (
              <div key={lane.name} className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{lane.name}</p>
                    <p className="text-xs text-muted-foreground">{lane.value} records</p>
                  </div>
                  <Badge variant={lane.badgeTone}>{lane.badge}</Badge>
                </div>
                <Progress value={lane.progress} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service Commitments</CardTitle>
            <CardDescription>Enterprise SLA and quality markers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded border p-3">
              <span>Escalation Response</span>
              <span className="font-medium text-emerald-600">11m</span>
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <span>Billing Accuracy</span>
              <span className="font-medium">99.2%</span>
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <span>Carrier Compliance</span>
              <span className="font-medium">97.8%</span>
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <span>Customer NPS</span>
              <span className="font-medium">62</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Command Feed</CardTitle>
          <CardDescription>Recent events with ownership and execution status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {activityRows.map((row) => (
            <div key={`${row.account}-${row.event}`} className="grid grid-cols-1 gap-2 rounded-md border p-3 text-sm md:grid-cols-[1.6fr_1.6fr_1fr_1fr_80px] md:items-center">
              <span className="font-medium">{row.account}</span>
              <span className="text-muted-foreground">{row.event}</span>
              <span>{row.owner}</span>
              <Badge variant={row.status === 'Escalated' ? 'destructive' : 'outline'}>{row.status}</Badge>
              <span className="text-right font-medium">{row.eta}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
