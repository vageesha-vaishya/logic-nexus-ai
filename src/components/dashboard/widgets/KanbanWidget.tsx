import { KanbanDashboard } from '@/components/dashboard/KanbanDashboard';
import { LeadsKanbanBoard } from './kanban/LeadsKanbanBoard';
import { OpportunitiesKanbanBoard } from './kanban/OpportunitiesKanbanBoard';
import { QuotesKanbanBoard } from './kanban/QuotesKanbanBoard';
import { ShipmentsKanbanBoard } from './kanban/ShipmentsKanbanBoard';
import { ActivitiesKanbanBoard } from './kanban/ActivitiesKanbanBoard';
import { WidgetProps } from '@/types/dashboard';
import { WidgetContainer } from '@/components/dashboard/WidgetContainer';

export function KanbanWidget({ config }: WidgetProps) {
  const module = config.settings?.module || 'overview';

  if (module === 'overview') {
    return (
      <div className="h-full">
        <KanbanDashboard />
      </div>
    );
  }

  const renderContent = () => {
    switch (module) {
      case 'leads':
        return <LeadsKanbanBoard />;
      case 'opportunities':
        return <OpportunitiesKanbanBoard />;
      case 'quotes':
        return <QuotesKanbanBoard />;
      case 'shipments':
        return <ShipmentsKanbanBoard />;
      case 'activities':
        return <ActivitiesKanbanBoard />;
      default:
        return null;
    }
  };

  return (
    <WidgetContainer title={config.title} className="h-full">
      {renderContent()}
    </WidgetContainer>
  );
}
