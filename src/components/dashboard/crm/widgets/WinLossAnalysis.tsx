import React from 'react';
import { BarChart3, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export function WinLossAnalysis() {
  // Mock win/loss data for demonstration
  const dealAnalysis = [
    { period: 'This Quarter', wins: 8, losses: 2, pending: 3, winRate: 80 },
    { period: 'Last Quarter', wins: 6, losses: 4, pending: 2, winRate: 60 },
    { period: 'YTD', wins: 18, losses: 6, pending: 5, winRate: 75 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-teal-600" />
        <h4 className="font-semibold text-gray-900">Win/Loss Analysis</h4>
      </div>
      <div className="space-y-3">
        {dealAnalysis.map((period, idx) => (
          <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
            <p className="text-sm font-medium text-gray-900 mb-2">{period.period}</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-gray-600">Wins</span>
                </div>
                <span className="text-sm font-semibold text-green-600">{period.wins}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-gray-600">Losses</span>
                </div>
                <span className="text-sm font-semibold text-red-600">{period.losses}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-gray-600">Pending</span>
                </div>
                <span className="text-sm font-semibold text-amber-600">{period.pending}</span>
              </div>
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-600">Win Rate</p>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-green-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${period.winRate}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-green-600">{period.winRate}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
