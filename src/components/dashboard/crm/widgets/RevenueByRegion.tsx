import React from 'react';
import { Map, TrendingUp } from 'lucide-react';

export function RevenueByRegion() {
  const regionData = [
    { name: 'North America', revenue: 1200000, percentage: 42, growth: '+12%' },
    { name: 'Europe', revenue: 850000, percentage: 30, growth: '+8%' },
    { name: 'Asia Pacific', revenue: 600000, percentage: 21, growth: '+25%' },
    { name: 'LATAM', revenue: 200000, percentage: 7, growth: '+5%' },
  ];

  const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Map className="h-5 w-5 text-teal-600" />
        <h4 className="font-semibold text-gray-900">Revenue by Region</h4>
      </div>
      <div className="space-y-3">
        {regionData.map((region, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-900">{region.name}</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">${(region.revenue / 1000).toFixed(0)}k</span>
                <span className={`text-xs font-medium ${region.growth.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                  {region.growth}
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="h-2.5 rounded-full transition-all"
                style={{
                  width: `${region.percentage}%`,
                  backgroundColor: colors[idx % colors.length],
                }}
              />
            </div>
            <p className="text-xs text-gray-500">{region.percentage}% of total revenue</p>
          </div>
        ))}
      </div>
      <div className="pt-3 border-t">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">Total Regional Revenue:</p>
          <p className="text-sm font-bold text-gray-900">$2.85M</p>
        </div>
        <div className="flex items-center gap-1 mt-2 text-blue-600">
          <TrendingUp className="h-4 w-4" />
          <p className="text-xs font-medium">Asia Pacific showing strongest growth</p>
        </div>
      </div>
    </div>
  );
}
