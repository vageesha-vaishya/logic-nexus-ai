import React from 'react';
import { TrendingUp, BarChart3 } from 'lucide-react';

export function SalesGrowthRate() {
  const growthData = {
    yoy: 18.5,
    quarterly: 5.2,
    monthly: 2.1,
    byProductLine: [
      { product: 'Enterprise Solutions', growth: 24.8, contribution: 52 },
      { product: 'Platform Services', growth: 16.3, contribution: 28 },
      { product: 'Support & Training', growth: 12.5, contribution: 20 },
    ],
    monthlyTrend: [
      { month: 'Jul', growth: 1.2 },
      { month: 'Aug', growth: 1.8 },
      { month: 'Sep', growth: 1.9 },
      { month: 'Oct', growth: 2.3 },
      { month: 'Nov', growth: 2.5 },
      { month: 'Dec', growth: 2.1 },
    ],
    forecast: {
      q1Next: 5.8,
      h1Next: 11.2,
    },
  };

  const maxGrowth = Math.max(...growthData.monthlyTrend.map(m => m.growth));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <h4 className="font-semibold text-gray-900">Sales Growth Rate</h4>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-xs text-blue-600 font-semibold">Year-over-Year</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">{growthData.yoy}%</p>
          <p className="text-xs text-blue-600 mt-1">growth</p>
        </div>
        <div className="p-3 bg-cyan-50 rounded border border-cyan-200">
          <p className="text-xs text-cyan-600 font-semibold">Quarterly</p>
          <p className="text-2xl font-bold text-cyan-900 mt-1">{growthData.quarterly}%</p>
          <p className="text-xs text-cyan-600 mt-1">growth</p>
        </div>
        <div className="p-3 bg-teal-50 rounded border border-teal-200">
          <p className="text-xs text-teal-600 font-semibold">Monthly</p>
          <p className="text-2xl font-bold text-teal-900 mt-1">{growthData.monthly}%</p>
          <p className="text-xs text-teal-600 mt-1">growth</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-700">Growth by Product Line</p>
        {growthData.byProductLine.map((product, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">{product.product}</p>
              <span className="text-sm font-semibold text-green-600">+{product.growth}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full"
                  style={{
                    width: `${product.contribution}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 w-8 text-right">{product.contribution}%</p>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t">
        <p className="text-xs font-semibold text-gray-700 mb-2">Monthly Trend (Last 6 Months)</p>
        <div className="flex items-end justify-between gap-1 h-16">
          {growthData.monthlyTrend.map((item, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center">
              <div
                className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all"
                style={{
                  height: `${(item.growth / maxGrowth) * 100}%`,
                }}
                title={`${item.month}: ${item.growth}%`}
              />
              <p className="text-xs text-gray-600 mt-1">{item.month}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t">
        <p className="text-xs font-semibold text-gray-700 mb-2">Forecast</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-blue-50 rounded border border-blue-200">
            <p className="text-xs text-blue-700">Q1 Expected Growth</p>
            <p className="text-lg font-bold text-blue-900">{growthData.forecast.q1Next}%</p>
          </div>
          <div className="p-2 bg-purple-50 rounded border border-purple-200">
            <p className="text-xs text-purple-700">H1 Projected Growth</p>
            <p className="text-lg font-bold text-purple-900">{growthData.forecast.h1Next}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
