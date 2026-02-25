import React from 'react';
import { BarChart3, TrendingUp, AlertCircle } from 'lucide-react';

export function ForecastVsActual() {
  // Mock forecast vs actual data for demonstration
  const months = [
    { month: 'Jan', forecast: 80, actual: 85, percentage: 106 },
    { month: 'Feb', forecast: 90, actual: 88, percentage: 98 },
    { month: 'Mar', forecast: 100, actual: 95, percentage: 95 },
    { month: 'Apr', forecast: 110, actual: 102, percentage: 93 },
  ];

  const maxValue = 110;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-green-600" />
        <h4 className="font-semibold text-gray-900">Forecast vs Actual</h4>
      </div>
      <div className="space-y-3">
        {months.map((item, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-900">{item.month}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Forecast: ${item.forecast}k</span>
                <span className="text-xs text-gray-500">Actual: ${item.actual}k</span>
              </div>
            </div>
            <div className="flex gap-1 h-6">
              <div
                className="bg-blue-200 rounded transition-all"
                style={{ width: `${(item.forecast / maxValue) * 100}%` }}
                title={`Forecast: $${item.forecast}k`}
              />
              <div
                className="bg-green-500 rounded transition-all"
                style={{ width: `${(item.actual / maxValue) * 100}%` }}
                title={`Actual: $${item.actual}k`}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="pt-3 border-t space-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-600" />
          <p className="text-sm text-gray-600">
            Quarterly Performance: <span className="font-semibold text-green-600">98%</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-amber-600">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm">Apr trending below forecast</p>
        </div>
      </div>
    </div>
  );
}
