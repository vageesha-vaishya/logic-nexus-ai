import React from 'react';
import { Target, AlertTriangle, CheckCircle } from 'lucide-react';

export function QuoteAccuracyTracker() {
  const accuracyData = {
    overall: 94,
    target: 95,
    trend: '+2%',
    variance: 2.8,
    byCategory: [
      { category: 'Labor', estimated: 8500, actual: 8340, variance: -1.9 },
      { category: 'Materials', estimated: 15200, actual: 15680, variance: 3.1 },
      { category: 'Equipment', estimated: 5800, actual: 5920, variance: 2.1 },
      { category: 'Services', estimated: 3400, actual: 3285, variance: -3.4 },
    ],
    recentQuotes: [
      { id: 'Q-2024-145', variance: 1.2, status: 'Excellent' },
      { id: 'Q-2024-144', variance: -0.8, status: 'Excellent' },
      { id: 'Q-2024-143', variance: 3.5, status: 'Good' },
      { id: 'Q-2024-142', variance: -2.1, status: 'Good' },
    ],
  };

  const maxVariance = Math.max(...accuracyData.byCategory.map(c => Math.abs(c.variance)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-green-600" />
          <h4 className="font-semibold text-gray-900">Quote Accuracy</h4>
        </div>
      </div>

      <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded border border-green-200">
        <p className="text-sm text-green-700 mb-1">Overall Accuracy</p>
        <div className="flex items-baseline gap-2 mb-3">
          <p className="text-3xl font-bold text-green-900">{accuracyData.overall}%</p>
          <p className="text-xs text-green-700">vs {accuracyData.target}% target</p>
        </div>
        <div className="w-full bg-green-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all"
            style={{ width: `${accuracyData.overall}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-700">Variance by Category (vs Estimated)</p>
        {accuracyData.byCategory.map((cat, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">{cat.category}</p>
              <span className={`text-sm font-semibold ${cat.variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {cat.variance > 0 ? '+' : ''}{cat.variance}%
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex-1 h-2 bg-gray-200 rounded-full relative">
                <div
                  className={`h-2 rounded-full transition-all ${
                    cat.variance > 0
                      ? 'bg-gradient-to-r from-red-400 to-red-500'
                      : 'bg-gradient-to-r from-green-400 to-green-500'
                  }`}
                  style={{
                    width: `${Math.min((Math.abs(cat.variance) / maxVariance) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 w-12 text-right">${cat.actual / 1000}k</p>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t space-y-1">
        {accuracyData.recentQuotes.map((quote, idx) => (
          <div key={idx} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
            <span className="text-gray-900 font-medium">{quote.id}</span>
            <div className="flex items-center gap-1">
              {quote.variance < 2 ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              )}
              <span className="text-gray-600">{quote.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
