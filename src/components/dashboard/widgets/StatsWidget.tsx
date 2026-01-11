import { WidgetProps } from '@/types/dashboard';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { useDashboardData } from '@/hooks/useDashboardData';

export function StatsWidget({ config }: WidgetProps) {
  const { loading } = useDashboardData();
  
  return (
    <div className="h-full">
      <StatsCards loading={loading} />
    </div>
  );
}
