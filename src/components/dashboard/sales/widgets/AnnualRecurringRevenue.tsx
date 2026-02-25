import React from 'react';
import { DollarSign, TrendingUp, BarChart3 } from 'lucide-react';

export function AnnualRecurringRevenue() {
  const arrData = {
    total: 2400000,
    target: 2800000,
    achievement: 85.7,
    trend: '+24%',
    bySegment: [
      { segment: 'Enterprise', arr: 1200000, percentage: 50, growth: '+28%' },
      { segment: 'Mid-Market', arr: 840000, percentage: 35, growth: '+18%' },
      { segment: 'SMB', arr: 360000, percentage: 15, growth: '+12%' },
    ],
    quarterly: [
      { q: 'Q1', arr: 2100000 },
      { q: 'Q2', arr: 2180000 },
      { q: 'Q3', arr: 2290000 },
      { q: 'Q4', arr: 2400000 },
    ],
  };

  const maxARR = Math.max(...arrData.quarterly.map(q => q.arr));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-emerald-600" />
          <h4 className="font-semibold text-gray-900">Annual Recurring Revenue</h4>
        </div>
        <div className="flex items-center gap-1 text-emerald-600">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm font-semibold">{arrData.trend}</span>
        </div>
      </div>

      <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded border border-emerald-200">
        <p className="text-sm text-emerald-700 mb-1">Total ARR</p>
        <p className="text-3xl font-bold text-emerald-900 mb-3">${(arrData.total / 1000000).toFixed(2)}M</p>
        <div className="flex items-center justify-between">
          <div className="flex-1 mr-3">
            <div className="w-full bg-emerald-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-emerald-500 to-green-600 h-3 rounded-full transition-all"
                style={{ width: `${arrData.achievement}%` }}
              />
            </div>
          </div>
          <p className="text-sm font-semibold text-emerald-700">{arrData.achievement.toFixed(1)}%</p>
        </div>
        <p className="text-xs text-emerald-700 mt-2">Target: ${(arrData.target / 1000000).toFixed(2)}M</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-700">ARR by Customer Segment</p>
        {arrData.bySegment.map((seg, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">{seg.segment}</p>
              <div className="text-right">
                <span className="text-sm font-semibold text-gray-900">${(seg.arr / 1000000).toFixed(2)}M</span>
                <p className="text-xs text-green-600 font-semibold">{seg.growth}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-green-600 h-2 rounded-full"
                  style={{
                    width: `${seg.percentage}%`,
                  }}
                />
              </div>
              <span className="text-xs font-semibold text-gray-600 w-8 text-right">{seg.percentage}%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t">
        <p className="text-xs font-semibold text-gray-700 mb-2">Quarterly ARR Growth</p>
        <div className="flex items-end justify-between gap-1 h-16">
          {arrData.quarterly.map((item, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center">
              <div
                className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t transition-all"
                style={{
                  height: `${(item.arr / maxARR) * 100}%`,
                }}
                title={`${item.q}: $${(item.arr / 1000000).toFixed(2)}M`}
              />
              <p className="text-xs text-gray-600 mt-1">{item.q}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
