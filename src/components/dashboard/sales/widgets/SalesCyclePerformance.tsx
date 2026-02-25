import React from 'react';
import { Clock, BarChart3, TrendingDown } from 'lucide-react';

export function SalesCyclePerformance() {
  const cycleData = {
    avgCycleDays: 34.2,
    target: 30,
    trend: '-2.1 days',
    byProductLine: [
      { product: 'Basic Service', avgDays: 18, deals: 12, percentage: 60 },
      { product: 'Standard Service', avgDays: 32, deals: 8, percentage: 72 },
      { product: 'Enterprise Service', avgDays: 48, deals: 5, percentage: 85 },
      { product: 'Consulting', avgDays: 42, deals: 4, percentage: 75 },
    ],
    stageBreakdown: [
      { stage: 'Lead to Qualified', days: 5, percentage: 14.6 },
      { stage: 'Qualified to Proposal', days: 8, percentage: 23.4 },
      { stage: 'Proposal to Negotiation', days: 12, percentage: 35.1 },
      { stage: 'Negotiation to Close', days: 9, percentage: 26.3 },
    ],
  };

  const maxDays = Math.max(...cycleData.byProductLine.map(p => p.avgDays));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-orange-600" />
          <h4 className="font-semibold text-gray-900">Sales Cycle Performance</h4>
        </div>
        <div className="flex items-center gap-1 text-green-600">
          <TrendingDown className="h-4 w-4" />
          <span className="text-sm font-semibold">{cycleData.trend}</span>
        </div>
      </div>

      <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded border border-orange-200">
        <p className="text-sm text-orange-700 mb-1">Average Sales Cycle</p>
        <div className="flex items-baseline gap-2 mb-3">
          <p className="text-3xl font-bold text-orange-900">{cycleData.avgCycleDays}</p>
          <p className="text-xs text-orange-700">days (target: {cycleData.target} days)</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="flex-1 h-2 bg-orange-200 rounded-full">
            <div
              className="bg-gradient-to-r from-orange-500 to-orange-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.min((cycleData.target / cycleData.avgCycleDays) * 100, 100)}%` }}
            />
          </div>
          <span className="text-xs text-orange-700 font-semibold">
            {((cycleData.avgCycleDays - cycleData.target) / cycleData.target * 100).toFixed(1)}% above
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-700">By Product Line</p>
        {cycleData.byProductLine.map((product, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">{product.product}</p>
              <div className="text-right">
                <span className="text-sm font-semibold text-gray-900">{product.avgDays} days</span>
                <p className="text-xs text-gray-500">{product.deals} deals</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-orange-400 to-orange-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${(product.avgDays / maxDays) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 w-8 text-right">{product.percentage}%</p>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t">
        <p className="text-xs font-semibold text-gray-700 mb-2">Stage Durations</p>
        <div className="space-y-1">
          {cycleData.stageBreakdown.map((stage, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
              <span className="text-gray-900 font-medium flex-1">{stage.stage}</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-400 to-blue-500 h-2 rounded-full"
                    style={{
                      width: `${(stage.percentage / 40) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-gray-600 w-8 text-right">{stage.days}d</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
