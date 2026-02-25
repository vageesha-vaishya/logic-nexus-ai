import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { SalesTeamSize } from './widgets/SalesTeamSize';
import { RevenueYTD } from './widgets/RevenueYTD';
import { MarketShare } from './widgets/MarketShare';
import { CustomerLifetimeValue } from './widgets/CustomerLifetimeValue';
import { SalesForecast } from './widgets/SalesForecast';
import { RevenueByRegion } from './widgets/RevenueByRegion';
import { TopAccounts } from './widgets/TopAccounts';
import { WinLossMetrics } from './widgets/WinLossMetrics';
import { WidgetInstance } from '@/types/dashboardTemplates';

const defaultWidgets: WidgetInstance[] = [
  { id: '1', type: 'sales_team_size', title: 'Sales Team Size', size: 'medium', position: 0 },
  { id: '2', type: 'revenue_ytd', title: 'Revenue YTD', size: 'medium', position: 1 },
  { id: '3', type: 'market_share', title: 'Market Share', size: 'large', position: 2 },
  { id: '4', type: 'clv', title: 'Customer Lifetime Value', size: 'medium', position: 3 },
  { id: '5', type: 'sales_forecast', title: 'Sales Forecast', size: 'large', position: 4 },
  { id: '6', type: 'revenue_by_region', title: 'Revenue by Region', size: 'large', position: 5 },
  { id: '7', type: 'top_accounts', title: 'Top 5 Accounts', size: 'medium', position: 6 },
  { id: '8', type: 'win_loss_metrics', title: 'Win/Loss Metrics', size: 'medium', position: 7 },
];

export function ExecutiveDashboard() {
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
      case 'sales_team_size':
        return <SalesTeamSize />;
      case 'revenue_ytd':
        return <RevenueYTD />;
      case 'market_share':
        return <MarketShare />;
      case 'clv':
        return <CustomerLifetimeValue />;
      case 'sales_forecast':
        return <SalesForecast />;
      case 'revenue_by_region':
        return <RevenueByRegion />;
      case 'top_accounts':
        return <TopAccounts />;
      case 'win_loss_metrics':
        return <WinLossMetrics />;
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
        <h2 className="text-3xl font-bold text-gray-900">Executive Dashboard</h2>
        <p className="text-gray-600 mt-1">Company-wide sales performance and strategic metrics</p>
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
