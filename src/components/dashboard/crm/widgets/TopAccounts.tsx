import React from 'react';
import { Star, DollarSign } from 'lucide-react';

export function TopAccounts() {
  const topAccounts = [
    { rank: 1, name: 'Enterprise Corp', revenue: 450000, growth: '+15%' },
    { rank: 2, name: 'Global Tech Solutions', revenue: 380000, growth: '+8%' },
    { rank: 3, name: 'Innovation Industries', revenue: 320000, growth: '+22%' },
    { rank: 4, name: 'Future Systems', revenue: 280000, growth: '+5%' },
    { rank: 5, name: 'Digital Ventures', revenue: 240000, growth: '+18%' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Star className="h-5 w-5 text-yellow-600" />
        <h4 className="font-semibold text-gray-900">Top 5 Accounts</h4>
      </div>
      <div className="space-y-2">
        {topAccounts.map((account) => (
          <div key={account.rank} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-xs font-bold text-white">
                {account.rank}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{account.name}</p>
                <div className="flex items-center gap-1 text-xs text-gray-600 mt-0.5">
                  <DollarSign className="h-3 w-3" />
                  {account.revenue.toLocaleString()}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${account.growth.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                {account.growth}
              </p>
              <p className="text-xs text-gray-500">YoY</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
