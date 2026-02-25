import React from 'react';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

export function CostAnalysis() {
  const costData = {
    fuelCost: { amount: 3240, change: 2.5 },
    maintenanceCost: { amount: 1560, change: -1.2 },
    laborCost: { amount: 5890, change: 0.8 },
    insuranceCost: { amount: 2100, change: 0 },
  };

  const costBreakdown = [
    { label: 'Fuel', amount: 3240, percentage: 32, color: 'bg-red-500' },
    { label: 'Labor', amount: 5890, percentage: 58, color: 'bg-blue-500' },
    { label: 'Maintenance', amount: 1560, percentage: 6, color: 'bg-yellow-500' },
    { label: 'Insurance', amount: 2100, percentage: 4, color: 'bg-green-500' },
  ];

  const totalCost = costBreakdown.reduce((sum, item) => sum + item.amount, 0);

  const CostTrendIcon = ({ change }: { change: number }) => {
    if (change > 0) {
      return <TrendingUp className="h-4 w-4 text-red-600" />;
    } else if (change < 0) {
      return <TrendingDown className="h-4 w-4 text-green-600" />;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">Cost Analysis (This Week)</h4>
      </div>

      <div className="p-3 bg-blue-50 rounded border border-blue-200">
        <p className="text-xs text-gray-600 mb-1">Total Operating Cost</p>
        <p className="text-2xl font-bold text-blue-700">${totalCost.toLocaleString()}</p>
        <p className="text-xs text-blue-600">Avg: ${(totalCost / 7).toFixed(2)}/day</p>
      </div>

      <div className="space-y-2">
        {costBreakdown.map((item, idx) => (
          <div key={idx} className="p-2 bg-gray-50 rounded border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
              </div>
              <span className="text-sm font-semibold text-gray-700">${item.amount.toLocaleString()}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${item.percentage}%` }}></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">{item.percentage}% of total</p>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-sm font-medium text-gray-900">Weekly Trends</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-gray-50 rounded border border-gray-200">
            <p className="text-xs text-gray-600">Fuel</p>
            <div className="flex items-center gap-2 mt-1">
              <CostTrendIcon change={costData.fuelCost.change} />
              <span className="text-sm font-semibold text-gray-900">
                {costData.fuelCost.change > 0 ? '+' : ''}{costData.fuelCost.change}%
              </span>
            </div>
          </div>
          <div className="p-2 bg-gray-50 rounded border border-gray-200">
            <p className="text-xs text-gray-600">Maintenance</p>
            <div className="flex items-center gap-2 mt-1">
              <CostTrendIcon change={costData.maintenanceCost.change} />
              <span className="text-sm font-semibold text-gray-900">
                {costData.maintenanceCost.change > 0 ? '+' : ''}{costData.maintenanceCost.change}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
