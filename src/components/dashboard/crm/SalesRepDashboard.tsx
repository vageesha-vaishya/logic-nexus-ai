import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { PipelineByStage } from './widgets/PipelineByStage';
import { SalesForecast } from './widgets/SalesForecast';
import { WinLossMetrics } from './widgets/WinLossMetrics';
import { RevenueYTD } from './widgets/RevenueYTD';
import { WidgetInstance } from '@/types/dashboardTemplates';

const defaultWidgets: WidgetInstance[] = [
  { id: '1', type: 'pipeline_by_stage', title: 'My Pipeline', size: 'large', position: 0 },
  { id: '2', type: 'sales_forecast', title: 'Sales Forecast', size: 'large', position: 1 },
  { id: '3', type: 'win_loss_metrics', title: 'Win/Loss Metrics', size: 'large', position: 2 },
  { id: '4', type: 'revenue_ytd', title: 'Revenue YTD', size: 'large', position: 3 },
];

export function SalesRepDashboard() {
  const [widgets, setWidgets] = useState<WidgetInstance[]>(defaultWidgets);
  const [resizedWidget, setResizedWidget] = useState<string | null>(null);

  const handleRemoveWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.id !== id));
  };

  const handleResizeWidget = (id: string) => {
    setResizedWidget(id === resizedWidget ? null : id);
  };

  const renderWidget = (widget: WidgetInstance) => {
    switch (widget.type) {
      case 'pipeline_by_stage':
        return <PipelineByStage />;
      case 'sales_forecast':
        return <SalesForecast />;
      case 'win_loss_metrics':
        return <WinLossMetrics />;
      case 'revenue_ytd':
        return <RevenueYTD />;
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

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Sales Rep Dashboard</h2>
        <p className="text-gray-600 mt-1">Your personal pipeline, forecasts, and sales performance</p>
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

      {widgets.length === 0 && (
        <Card className="col-span-4 text-center py-12">
          <p className="text-gray-500 mb-4">All widgets have been removed</p>
          <Button
            variant="outline"
            onClick={() => setWidgets(defaultWidgets)}
          >
            Reset Dashboard
          </Button>
        </Card>
      )}
    </div>
  );
}
