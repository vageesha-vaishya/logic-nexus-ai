import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { RevenueTrends } from './widgets/RevenueTrends';
import { PipelineOverview } from './widgets/PipelineOverview';
import { SalesPerformance } from './widgets/SalesPerformance';
import { KeyAccounts } from './widgets/KeyAccounts';
import { WidgetInstance } from '@/types/dashboardTemplates';
import { useDashboardPreferences } from '@/hooks/useDashboardPreferences';

const defaultWidgets: WidgetInstance[] = [
  { id: '1', type: 'revenue_trends', title: 'Revenue Trends', size: 'full', position: 0 },
  { id: '2', type: 'pipeline_overview', title: 'Pipeline Overview', size: 'large', position: 1 },
  { id: '3', type: 'sales_performance', title: 'Regional Performance', size: 'large', position: 2 },
  { id: '4', type: 'key_accounts', title: 'Strategic Accounts', size: 'large', position: 3 },
];

export function ExecutiveDashboard() {
  const { widgets, loading, savePreferences } = useDashboardPreferences(defaultWidgets);
  const [resizedWidget, setResizedWidget] = React.useState<string | null>(null);

  const handleRemoveWidget = (id: string) => {
    const updatedWidgets = widgets.filter(w => w.id !== id);
    savePreferences(updatedWidgets);
  };

  const handleResizeWidget = (id: string) => {
    setResizedWidget(id === resizedWidget ? null : id);
  };

  const renderWidget = (widget: WidgetInstance) => {
    switch (widget.type) {
      case 'revenue_trends':
        return <RevenueTrends />;
      case 'pipeline_overview':
        return <PipelineOverview />;
      case 'sales_performance':
        return <SalesPerformance />;
      case 'key_accounts':
        return <KeyAccounts />;
      default:
        return <div className="text-gray-500">Unknown widget type: {widget.type}</div>;
    }
  };

  const getGridColSpan = (size: WidgetInstance['size']) => {
    switch (size) {
      case 'full':
        return 'col-span-1 md:col-span-4';
      case 'large':
        return 'col-span-1 md:col-span-2';
      case 'medium':
        return 'col-span-1 md:col-span-2';
      case 'small':
        return 'col-span-1';
      default:
        return 'col-span-1';
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading dashboard preferences...</div>;
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Executive Dashboard</h2>
        <p className="text-gray-600 mt-1">High-level insights, revenue trends, and strategic metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-max">
        {widgets.map(widget => (
          <Card
            key={widget.id}
            className={`${getGridColSpan(widget.size)} overflow-hidden hover:shadow-lg transition-shadow`}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
              <CardTitle className="text-base font-semibold">{widget.title}</CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => handleResizeWidget(widget.id)}
                  title={resizedWidget === widget.id ? 'Minimize' : 'Maximize'}
                >
                  {resizedWidget === widget.id ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleRemoveWidget(widget.id)}
                  title="Remove widget"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {renderWidget(widget)}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
