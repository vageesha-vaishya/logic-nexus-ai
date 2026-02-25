import React from 'react';
import { TrendingUp, Calendar } from 'lucide-react';

export function SalesForecast() {
  const forecastData = [
    { month: 'May', forecast: 720000, lowCase: 650000, highCase: 800000 },
    { month: 'Jun', forecast: 750000, lowCase: 680000, highCase: 850000 },
    { month: 'Jul', forecast: 780000, lowCase: 700000, highCase: 900000 },
    { month: 'Aug', forecast: 800000, lowCase: 720000, highCase: 920000 },
  ];

  const maxValue = 920000;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-cyan-600" />
        <h4 className="font-semibold text-gray-900">Sales Forecast</h4>
      </div>
      <div className="space-y-3">
        {forecastData.map((item, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-900">{item.month}</p>
              <p className="text-sm font-semibold text-cyan-600">${(item.forecast / 1000).toFixed(0)}k</p>
            </div>
            <div className="flex gap-0.5 h-5 items-center">
              <div
                className="bg-cyan-200 rounded-sm relative group"
                style={{ width: `${(item.lowCase / maxValue) * 100}%` }}
                title={`Low: $${(item.lowCase / 1000).toFixed(0)}k`}
              />
              <div
                className="bg-cyan-500 rounded-sm relative group"
                style={{ width: `${((item.forecast - item.lowCase) / maxValue) * 100}%` }}
                title={`Forecast: $${(item.forecast / 1000).toFixed(0)}k`}
              />
              <div
                className="bg-cyan-300 rounded-sm relative group"
                style={{ width: `${((item.highCase - item.forecast) / maxValue) * 100}%` }}
                title={`High: $${(item.highCase / 1000).toFixed(0)}k`}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>${(item.lowCase / 1000).toFixed(0)}k</span>
              <span>${(item.highCase / 1000).toFixed(0)}k</span>
            </div>
          </div>
        ))}
      </div>
      <div className="pt-3 border-t">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4 text-cyan-600" />
          <p className="text-sm font-medium text-gray-900">Next Quarter Outlook</p>
        </div>
        <p className="text-sm text-gray-600">
          Projected Total: <span className="font-semibold text-cyan-600">$3.05M</span>
        </p>
        <p className="text-xs text-gray-500 mt-1">Based on current pipeline and conversion rates</p>
      </div>
    </div>
  );
}
