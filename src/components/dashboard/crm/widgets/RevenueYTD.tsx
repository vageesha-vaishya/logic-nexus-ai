import React from 'react';
import { DollarSign, TrendingUp, Target } from 'lucide-react';

export function RevenueYTD() {
  const revenueData = {
    ytd: 2850000,
    target: 3000000,
    achieved: 95,
    growth: '+18%',
    byQuarter: [
      { q: 'Q1', revenue: 680000 },
      { q: 'Q2', revenue: 720000 },
      { q: 'Q3', revenue: 750000 },
      { q: 'Q4', revenue: 700000 },
    ],
  };

  const maxRevenue = Math.max(...revenueData.byQuarter.map(q => q.revenue));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          <h4 className="font-semibold text-gray-900">Revenue YTD</h4>
        </div>
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm font-semibold">{revenueData.growth}</span>
        </div>
      </div>

      <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded border border-green-200">
        <p className="text-sm text-green-700 mb-1">Year-to-Date Revenue</p>
        <p className="text-3xl font-bold text-green-900">${(revenueData.ytd / 1000000).toFixed(2)}M</p>
        <div className="flex items-center gap-2 mt-3">
          <Target className="h-4 w-4 text-green-700" />
          <p className="text-xs text-green-700">Target: ${(revenueData.target / 1000000).toFixed(2)}M</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-900">Target Achievement</p>
          <span className="text-sm font-semibold text-green-600">{revenueData.achieved}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all"
            style={{ width: `${revenueData.achieved}%` }}
          />
        </div>
      </div>

      <div className="pt-3 border-t">
        <p className="text-xs font-semibold text-gray-700 mb-2">Quarterly Breakdown</p>
        <div className="flex items-end justify-between gap-2">
          {revenueData.byQuarter.map((item, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded transition-all"
                style={{ height: `${(item.revenue / maxRevenue) * 40}px` }}
                title={`${item.q}: $${(item.revenue / 1000).toFixed(0)}k`}
              />
              <p className="text-xs text-gray-600">{item.q}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
