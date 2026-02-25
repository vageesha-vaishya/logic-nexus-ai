import React from 'react';
import { PieChart, DollarSign, TrendingUp } from 'lucide-react';

export function CostBreakdown() {
  const costData = [
    { category: 'Labor', amount: 15200, percentage: 42, color: 'bg-blue-500' },
    { category: 'Fuel & Maintenance', amount: 8500, percentage: 24, color: 'bg-yellow-500' },
    { category: 'Vehicle Depreciation', amount: 6800, percentage: 19, color: 'bg-purple-500' },
    { category: 'Warehouse Operations', amount: 4200, percentage: 12, color: 'bg-green-500' },
    { category: 'Other', amount: 1300, percentage: 3, color: 'bg-gray-500' },
  ];

  const totalCost = costData.reduce((sum, item) => sum + item.amount, 0);

  const monthlyComparison = [
    { month: 'Jan', cost: 34500 },
    { month: 'Feb', cost: 36000 },
    { month: 'Mar', cost: 36000 },
  ];

  const maxCost = Math.max(...monthlyComparison.map((m) => m.cost));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">Cost Breakdown (Monthly)</h4>
      </div>

      <div className="p-3 bg-blue-50 rounded border border-blue-200">
        <p className="text-xs text-gray-600 mb-1">Total Monthly Cost</p>
        <p className="text-2xl font-bold text-blue-700">${totalCost.toLocaleString()}</p>
        <p className="text-xs text-blue-600">Avg: ${(totalCost / 30).toFixed(2)}/day</p>
      </div>

      <div className="space-y-2">
        {costData.map((item, idx) => (
          <div key={idx} className="p-2 bg-gray-50 rounded border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                <p className="text-sm font-medium text-gray-900">{item.category}</p>
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

      <div className="mt-4">
        <p className="text-sm font-medium text-gray-900 mb-3">Monthly Trend</p>
        <div className="space-y-2">
          {monthlyComparison.map((month, idx) => (
            <div key={idx} className="p-2 bg-gray-50 rounded border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-gray-900">{month.month}</p>
                <span className="text-sm font-semibold text-gray-700">${month.cost.toLocaleString()}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${(month.cost / maxCost) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200">
        <TrendingUp className="h-4 w-4 text-blue-600" />
        <p className="text-xs text-blue-700">
          <span className="font-medium">Mar vs Feb:</span> +${(monthlyComparison[2].cost - monthlyComparison[1].cost).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
