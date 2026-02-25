import React from 'react';
import { BarChart3, CheckCircle, XCircle, TrendingUp } from 'lucide-react';

export function WinLossMetrics() {
  const winLossMetrics = {
    totalDeals: 56,
    wins: 42,
    losses: 14,
    winRate: 75,
    avgDealSize: 67857,
    lossReasons: [
      { reason: 'Price', percentage: 40, count: 6 },
      { reason: 'Competition', percentage: 35, count: 5 },
      { reason: 'Timing', percentage: 20, count: 3 },
      { reason: 'Other', percentage: 5, count: 1 },
    ],
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-emerald-600" />
        <h4 className="font-semibold text-gray-900">Win/Loss Metrics</h4>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 bg-green-50 rounded border border-green-200">
          <div className="flex items-center gap-1 mb-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-xs font-medium text-green-700">Wins</span>
          </div>
          <p className="text-xl font-bold text-green-900">{winLossMetrics.wins}</p>
        </div>
        <div className="p-2 bg-red-50 rounded border border-red-200">
          <div className="flex items-center gap-1 mb-1">
            <XCircle className="h-4 w-4 text-red-600" />
            <span className="text-xs font-medium text-red-700">Losses</span>
          </div>
          <p className="text-xl font-bold text-red-900">{winLossMetrics.losses}</p>
        </div>
        <div className="p-2 bg-blue-50 rounded border border-blue-200">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">Rate</span>
          </div>
          <p className="text-xl font-bold text-blue-900">{winLossMetrics.winRate}%</p>
        </div>
      </div>

      <div className="pt-3 border-t">
        <p className="text-sm font-medium text-gray-900 mb-2">Loss Analysis</p>
        <div className="space-y-2">
          {winLossMetrics.lossReasons.map((reason, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-600">{reason.reason}</p>
                <span className="text-xs font-semibold text-gray-900">{reason.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-orange-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${reason.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t">
        <p className="text-sm text-gray-600">
          Avg Deal Size: <span className="font-bold text-gray-900">${(winLossMetrics.avgDealSize / 1000).toFixed(0)}k</span>
        </p>
      </div>
    </div>
  );
}
