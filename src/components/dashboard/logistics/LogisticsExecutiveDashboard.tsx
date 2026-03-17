import { EnterpriseDashboardShell } from '@/components/dashboard/EnterpriseDashboardShell';
import { useEnterpriseDashboardData } from '@/hooks/useEnterpriseDashboardData';

export function LogisticsExecutiveDashboard() {
  const { loading, showAlerts, kpis, lanes, activityRows } = useEnterpriseDashboardData({
    profile: 'operations',
    emphasis: 'throughput',
  });

  return (
    <EnterpriseDashboardShell
      profile="operations"
      heading="Operations Command Center"
      subheading="Enterprise operations surface for intake, execution lanes, and SLA compliance"
      loading={loading}
      showAlerts={showAlerts}
      kpis={kpis}
      lanes={lanes}
      activityRows={activityRows}
    />
  );
}
