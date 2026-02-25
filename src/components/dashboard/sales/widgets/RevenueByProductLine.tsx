import React from 'react';
import { PieChart, TrendingUp } from 'lucide-react';

export function RevenueByProductLine() {
  const revenueData = {
    total: 5850000,
    trend: '+22%',
    productLines: [
      {
        name: 'Enterprise Solutions',
        revenue: 2340000,
        percentage: 40,
        color: 'bg-blue-500',
        lightColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        growth: '+28%',
        margin: 35,
      },
      {
        name: 'Cloud Services',
        revenue: 1755000,
        percentage: 30,
        color: 'bg-cyan-500',
        lightColor: 'bg-cyan-50',
        textColor: 'text-cyan-700',
        growth: '+18%',
        margin: 42,
      },
      {
        name: 'Integration Platform',
        revenue: 1170000,
        percentage: 20,
        color: 'bg-purple-500',
        lightColor: 'bg-purple-50',
        textColor: 'text-purple-700',
        growth: '+12%',
        margin: 38,
      },
      {
        name: 'Professional Services',
        revenue: 585000,
        percentage: 10,
        color: 'bg-orange-500',
        lightColor: 'bg-orange-50',
        textColor: 'text-orange-700',
        growth: '+8%',
        margin: 25,
      },
    ],
  };

  const maxRevenue = Math.max(...revenueData.productLines.map(p => p.revenue));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChart className="h-5 w-5 text-indigo-600" />
          <h4 className="font-semibold text-gray-900">Revenue by Product Line</h4>
        </div>
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm font-semibold">{revenueData.trend}</span>
        </div>
      </div>

      <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded border border-indigo-200">
        <p className="text-sm text-indigo-700 mb-1">Total Revenue</p>
        <p className="text-3xl font-bold text-indigo-900">${(revenueData.total / 1000000).toFixed(2)}M</p>
      </div>

      <div className="space-y-2">
        {revenueData.productLines.map((product, idx) => (
          <div key={idx} className={`p-3 rounded border-l-4 ${product.lightColor} border-l-${product.color.split('-')[1]}-500`}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-gray-900">{product.name}</p>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">${(product.revenue / 1000000).toFixed(2)}M</p>
                <p className={`text-xs font-semibold ${product.textColor}`}>{product.growth}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-2 bg-gray-300 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${product.color}`}
                  style={{
                    width: `${(product.revenue / maxRevenue) * 100}%`,
                  }}
                />
              </div>
              <span className="text-xs font-semibold text-gray-600 w-8 text-right">{product.percentage}%</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Gross Margin</span>
              <span className="font-semibold text-gray-900">{product.margin}%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t">
        <p className="text-xs font-semibold text-gray-700 mb-3">Revenue Mix</p>
        <div className="flex items-center justify-center gap-1 h-12 mb-3">
          {revenueData.productLines.map((product, idx) => (
            <div
              key={idx}
              className={`h-full rounded transition-all ${product.color}`}
              style={{
                width: `${product.percentage}%`,
              }}
              title={`${product.name}: ${product.percentage}%`}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 bg-green-50 rounded border border-green-200">
          <p className="text-xs text-green-700 font-semibold">Avg Margin</p>
          <p className="text-lg font-bold text-green-900">35%</p>
        </div>
        <div className="p-2 bg-blue-50 rounded border border-blue-200">
          <p className="text-xs text-blue-700 font-semibold">Top Product</p>
          <p className="text-sm font-bold text-blue-900">Enterprise</p>
        </div>
      </div>
    </div>
  );
}
