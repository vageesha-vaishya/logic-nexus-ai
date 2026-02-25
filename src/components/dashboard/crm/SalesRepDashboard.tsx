import React, { useState } from 'react';
import { Widget } from '../Widget';
import { HeroMetrics } from './widgets/HeroMetrics';
import { MyActiveLeads } from './widgets/MyActiveLeads';
import { QuickActions } from './widgets/QuickActions';
import { ActivityCalendar } from './widgets/ActivityCalendar';
import { TodayActivityStream } from './widgets/TodayActivityStream';
import { WidgetInstance } from '@/types/dashboardTemplates';

const defaultWidgets: WidgetInstance[] = [
  { id: '1', type: 'stats', title: "Today's Metrics", size: 'full', position: 0 },
  { id: '2', type: 'leads', title: 'My Active Leads', size: 'large', position: 1 },
  { id: '3', type: 'stats', title: 'Quick Actions', size: 'small', position: 2 },
  { id: '4', type: 'activities', title: 'Activity Calendar', size: 'medium', position: 3 },
  { id: '5', type: 'activities', title: "Today's Activities", size: 'medium', position: 4 },
];

export function SalesRepDashboard() {
  const [widgets, setWidgets] = useState<WidgetInstance[]>(defaultWidgets);

  const handleRemoveWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.id !== id));
  };

  const handleResizeWidget = (id: string, newSize: WidgetInstance['size']) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, size: newSize } : w));
  };

  const renderWidget = (widget: WidgetInstance) => {
    // Map widget types to their components
    switch (widget.type) {
      case 'stats':
        if (widget.id === '1') return <HeroMetrics />;
        if (widget.id === '3') return <QuickActions />;
        return <div>Unknown stats widget</div>;
      case 'leads':
        return <MyActiveLeads />;
      case 'activities':
        if (widget.id === '4') return <ActivityCalendar />;
        if (widget.id === '5') return <TodayActivityStream />;
        return <div>Unknown activities widget</div>;
      default:
        return <div>Unknown widget type: {widget.type}</div>;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-max">
      {widgets.map(widget => (
        <Widget
          key={widget.id}
          id={widget.id}
          title={widget.title}
          size={widget.size}
          onRemove={handleRemoveWidget}
          onResize={handleResizeWidget}
        >
          {renderWidget(widget)}
        </Widget>
      ))}
    </div>
  );
}
