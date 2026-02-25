import React from 'react';
import { PieChart, TrendingUp } from 'lucide-react';

export function MarketShare() {
  const marketData = [
    { competitor: 'Our Company', share: 28, revenue: '$2.8M', color: '#3b82f6', growth: '+8%' },
    { competitor: 'Competitor A', share: 25, revenue: '$2.5M', color: '#8b5cf6', growth: '+2%' },
    { competitor: 'Competitor B', share: 22, revenue: '$2.2M', color: '#ec4899', growth: '-1%' },
    { competitor: 'Competitor C', share: 15, revenue: '$1.5M', color: '#f59e0b', growth: '+3%' },
    { competitor: 'Others', share: 10, revenue: '$1.0M', color: '#d1d5db', growth: '+1%' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="h-5 w-5 text-indigo-600" />
        <h4 className="font-semibold text-gray-900">Market Share</h4>
      </div>
      <div className="space-y-2">
        {marketData.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{item.competitor}</p>
                <p className="text-xs text-gray-500">{item.revenue}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{item.share}%</p>
                <p className={`text-xs font-medium ${item.growth.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                  {item.growth}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="pt-3 border-t">
        <p className="text-xs text-gray-600">
          Industry Total: <span className="font-semibold text-gray-900">$10.0M</span>
        </p>
        <div className="flex items-center gap-1 mt-2 text-blue-600">
          <TrendingUp className="h-4 w-4" />
          <p className="text-xs font-medium">Leading market position YoY</p>
        </div>
      </div>
    </div>
  );
}
