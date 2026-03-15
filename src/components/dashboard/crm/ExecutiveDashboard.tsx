import { EnterpriseDashboardShell } from '@/components/dashboard/EnterpriseDashboardShell';
import { useEnterpriseDashboardData } from '@/hooks/useEnterpriseDashboardData';

export function ExecutiveDashboard() {
  const { loading, showAlerts, kpis, lanes, activityRows } = useEnterpriseDashboardData({
    profile: 'executive',
    emphasis: 'margin',
  });

  return (
    <EnterpriseDashboardShell
      profile="executive"
      heading="Executive Performance Dashboard"
      subheading="Enterprise command surface for revenue coverage, risk visibility, and strategic throughput"
      loading={loading}
      showAlerts={showAlerts}
      kpis={kpis}
      lanes={lanes}
      activityRows={activityRows}
    />
  );
}
