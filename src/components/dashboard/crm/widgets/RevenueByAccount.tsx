import React from 'react';
import { PieChart, DollarSign, TrendingUp } from 'lucide-react';

export function RevenueByAccount() {
  // Mock revenue data for demonstration
  const accounts = [
    { name: 'Acme Corporation', revenue: 125000, percentage: 35 },
    { name: 'Global Enterprises', revenue: 98500, percentage: 28 },
    { name: 'Tech Solutions Inc', revenue: 75000, percentage: 21 },
    { name: 'Innovation Labs', revenue: 50000, percentage: 16 },
  ];

  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'];
  const totalRevenue = accounts.reduce((sum, acc) => sum + acc.revenue, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="h-5 w-5 text-pink-600" />
        <h4 className="font-semibold text-gray-900">Revenue by Account</h4>
      </div>
      <div className="space-y-2">
        {accounts.map((account, idx) => (
          <div key={idx} className="flex items-center justify-between p-2">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colors[idx % colors.length] }}
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{account.name}</p>
                <p className="text-xs text-gray-500">${(account.revenue / 1000).toFixed(0)}k</p>
              </div>
            </div>
            <span className="text-sm font-semibold text-gray-900">{account.percentage}%</span>
          </div>
        ))}
      </div>
      <div className="pt-3 border-t">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <p className="text-sm text-gray-600">Total Revenue:</p>
          </div>
          <p className="text-sm font-bold text-green-600">${(totalRevenue / 1000).toFixed(0)}k</p>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <TrendingUp className="h-4 w-4 text-green-600" />
          <p className="text-xs text-green-600">+12% from last quarter</p>
        </div>
      </div>
    </div>
  );
}
