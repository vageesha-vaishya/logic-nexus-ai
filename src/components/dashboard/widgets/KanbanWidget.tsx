import { KanbanDashboard } from '@/components/dashboard/KanbanDashboard';
import { WidgetProps } from '@/types/dashboard';

export function KanbanWidget({ config }: WidgetProps) {
  return (
    <div className="h-full">
      <KanbanDashboard />
    </div>
  );
}
