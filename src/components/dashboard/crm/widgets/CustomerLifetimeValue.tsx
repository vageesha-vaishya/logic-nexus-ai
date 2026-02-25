import React from 'react';
import { Users, TrendingUp, Award } from 'lucide-react';

export function CustomerLifetimeValue() {
  const clvMetrics = {
    avgClv: 125000,
    totalClv: 3000000,
    activeCustomers: 24,
    highValueSegment: 8,
    growth: '+15%',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-600" />
          <h4 className="font-semibold text-gray-900">Customer Lifetime Value</h4>
        </div>
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm font-semibold">{clvMetrics.growth}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-amber-50 rounded border border-amber-200">
          <p className="text-2xl font-bold text-amber-900">${(clvMetrics.avgClv / 1000).toFixed(0)}k</p>
          <p className="text-xs text-amber-700 mt-1">Avg CLV</p>
        </div>
        <div className="p-3 bg-purple-50 rounded border border-purple-200">
          <p className="text-2xl font-bold text-purple-900">${(clvMetrics.totalClv / 1000000).toFixed(1)}M</p>
          <p className="text-xs text-purple-700 mt-1">Total CLV</p>
        </div>
        <div className="p-3 bg-green-50 rounded border border-green-200">
          <p className="text-2xl font-bold text-green-900">{clvMetrics.activeCustomers}</p>
          <p className="text-xs text-green-700 mt-1">Active Customers</p>
        </div>
        <div className="p-3 bg-red-50 rounded border border-red-200">
          <p className="text-2xl font-bold text-red-900">{clvMetrics.highValueSegment}</p>
          <p className="text-xs text-red-700 mt-1">High-Value Segment</p>
        </div>
      </div>

      <div className="pt-3 border-t">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-900">Health Score</p>
          <span className="text-sm font-semibold text-green-600">Excellent</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all" style={{ width: '88%' }} />
        </div>
      </div>
    </div>
  );
}
