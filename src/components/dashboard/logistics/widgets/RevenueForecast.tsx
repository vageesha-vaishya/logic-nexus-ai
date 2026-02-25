import React from 'react';
import { TrendingUp, DollarSign, BarChart3 } from 'lucide-react';

export function RevenueForecast() {
  const forecastData = [
    { month: 'January', actual: 145000, forecast: 140000, variance: 5000 },
    { month: 'February', actual: 152000, forecast: 150000, variance: 2000 },
    { month: 'March', actual: 158000, forecast: 160000, variance: -2000 },
    { month: 'April', actual: null, forecast: 168000, variance: null },
    { month: 'May', actual: null, forecast: 175000, variance: null },
    { month: 'June', actual: null, forecast: 182000, variance: null },
  ];

  const totalRevenue = forecastData
    .filter((d) => d.actual)
    .reduce((sum, d) => sum + (d.actual || 0), 0);
  const avgRevenue = totalRevenue / forecastData.filter((d) => d.actual).length;
  const Q2Forecast = 525000; // Apr + May + Jun

  const maxRevenue = 200000;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">Revenue Forecast</h4>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 bg-green-50 rounded border border-green-200">
          <p className="text-xs text-gray-600">YTD Revenue</p>
          <p className="text-2xl font-bold text-green-700">${(totalRevenue / 1000).toFixed(0)}K</p>
          <p className="text-xs text-green-600">Avg: ${(avgRevenue / 1000).toFixed(0)}K/mo</p>
        </div>
        <div className="p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-xs text-gray-600">Q2 Forecast</p>
          <p className="text-2xl font-bold text-blue-700">${(Q2Forecast / 1000).toFixed(0)}K</p>
          <p className="text-xs text-blue-600">+15% vs Q1</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-gray-900 mb-3">Monthly Forecast vs Actual</p>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {forecastData.map((month, idx) => {
            const isActual = month.actual !== null;

            return (
              <div key={idx} className={`p-2 rounded border ${isActual ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex items-center justify-between mb-1 text-sm">
                  <span className="font-medium text-gray-900">{month.month}</span>
                  <div className="flex items-center gap-2">
                    {isActual && (
                      <span className="text-xs text-green-600 font-medium">${(month.actual! / 1000).toFixed(0)}K</span>
                    )}
                    <span className="text-xs text-gray-600">${(month.forecast / 1000).toFixed(0)}K forecast</span>
                  </div>
                </div>
                <div className="flex gap-1 h-4">
                  {isActual && (
                    <div
                      className="bg-green-500 rounded"
                      style={{ width: `${(month.actual! / maxRevenue) * 100}%` }}
                    ></div>
                  )}
                  <div
                    className="bg-blue-300 rounded opacity-50"
                    style={{ width: `${(month.forecast / maxRevenue) * 100}%` }}
                  ></div>
                </div>
                {isActual && month.variance && (
                  <p className="text-xs text-gray-600 mt-1">
                    Variance: {month.variance > 0 ? '+' : ''}{(month.variance / 1000).toFixed(1)}K
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-3 bg-green-50 rounded border border-green-200 flex items-start gap-2">
        <BarChart3 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-green-900">Strong growth trajectory</p>
          <p className="text-xs text-green-700">On track to exceed annual targets</p>
        </div>
      </div>
    </div>
  );
}
