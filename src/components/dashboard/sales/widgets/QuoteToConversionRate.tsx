import React from 'react';
import { TrendingUp, CheckCircle } from 'lucide-react';

export function QuoteToConversionRate() {
  const conversionData = {
    overall: 38.5,
    target: 40,
    trend: '+2.3%',
    byRep: [
      { name: 'Jordan Davis', quotes: 24, converted: 12, rate: 50, trend: '+5%' },
      { name: 'Lisa Anderson', quotes: 22, converted: 9, rate: 40.9, trend: '+3%' },
      { name: 'Mike Thompson', quotes: 19, converted: 7, rate: 36.8, trend: '-1%' },
      { name: 'Alex Chen', quotes: 18, converted: 6, rate: 33.3, trend: '+2%' },
      { name: 'Sarah Miller', quotes: 21, converted: 6, rate: 28.6, trend: '-4%' },
    ],
    timeline: [
      { month: 'Aug', rate: 32.1 },
      { month: 'Sep', rate: 34.8 },
      { month: 'Oct', rate: 36.2 },
      { month: 'Nov', rate: 37.5 },
      { month: 'Dec', rate: 38.5 },
    ],
  };

  const maxRate = Math.max(...conversionData.byRep.map(r => r.rate));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <h4 className="font-semibold text-gray-900">Quote to Deal Conversion</h4>
        </div>
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm font-semibold">{conversionData.trend}</span>
        </div>
      </div>

      <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded border border-green-200">
        <p className="text-sm text-green-700 mb-1">Overall Conversion Rate</p>
        <div className="flex items-baseline gap-2 mb-3">
          <p className="text-3xl font-bold text-green-900">{conversionData.overall}%</p>
          <p className="text-xs text-green-700">target: {conversionData.target}%</p>
        </div>
        <div className="w-full bg-green-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all"
            style={{ width: `${Math.min(conversionData.overall, 100)}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-700">Rep Performance</p>
        {conversionData.byRep.map((rep, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">{rep.name}</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{rep.rate.toFixed(1)}%</span>
                <span className={`text-xs font-semibold ${rep.trend.includes('-') ? 'text-red-600' : 'text-green-600'}`}>
                  {rep.trend}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${(rep.rate / maxRate) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 w-12 text-right">{rep.converted}/{rep.quotes}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t">
        <p className="text-xs font-semibold text-gray-700 mb-2">Conversion Trend (Last 5 Months)</p>
        <div className="flex items-end justify-between gap-1 h-12">
          {conversionData.timeline.map((item, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center">
              <div
                className="w-full bg-gradient-to-t from-green-500 to-green-400 rounded-t transition-all"
                style={{
                  height: `${(item.rate / 50) * 100}%`,
                }}
                title={`${item.month}: ${item.rate}%`}
              />
              <p className="text-xs text-gray-600 mt-1">{item.month}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
