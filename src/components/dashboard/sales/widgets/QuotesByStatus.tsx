import React from 'react';
import { FileText, BarChart3 } from 'lucide-react';

export function QuotesByStatus() {
  const statusData = {
    total: 156,
    statuses: [
      { name: 'Draft', count: 18, percentage: 11.5, color: 'bg-yellow-500', lightColor: 'bg-yellow-50', textColor: 'text-yellow-700' },
      { name: 'Sent', count: 42, percentage: 26.9, color: 'bg-blue-500', lightColor: 'bg-blue-50', textColor: 'text-blue-700' },
      { name: 'Under Review', count: 35, percentage: 22.4, color: 'bg-purple-500', lightColor: 'bg-purple-50', textColor: 'text-purple-700' },
      { name: 'Accepted', count: 38, percentage: 24.4, color: 'bg-green-500', lightColor: 'bg-green-50', textColor: 'text-green-700' },
      { name: 'Rejected', count: 23, percentage: 14.7, color: 'bg-red-500', lightColor: 'bg-red-50', textColor: 'text-red-700' },
    ],
  };

  const totalValue = 2450000;
  const valueByStatus = [
    { name: 'Draft', value: 185000 },
    { name: 'Sent', value: 625000 },
    { name: 'Under Review', value: 890000 },
    { name: 'Accepted', value: 750000 },
    { name: 'Rejected', value: 0 },
  ];

  const maxPercentage = Math.max(...statusData.statuses.map(s => s.percentage));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-600" />
          <h4 className="font-semibold text-gray-900">Quotes by Status</h4>
        </div>
        <div className="flex items-center gap-1">
          <BarChart3 className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600 font-semibold">{statusData.total} total</span>
        </div>
      </div>

      <div className="space-y-3">
        {statusData.statuses.map((status, idx) => {
          const statusValue = valueByStatus[idx];
          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">{status.name}</p>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{status.count}</p>
                  <p className="text-xs text-gray-500">${(statusValue.value / 1000).toFixed(0)}k</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all ${status.color}`}
                    style={{
                      width: `${(status.percentage / maxPercentage) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-600 w-10 text-right">
                  {status.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-3 border-t">
        <p className="text-xs font-semibold text-gray-700 mb-2">Pipeline Value Distribution</p>
        <div className="flex items-end justify-between gap-1 h-16">
          {valueByStatus.map((item, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center">
              <div
                className={`w-full ${statusData.statuses[idx].color} rounded-t transition-all`}
                style={{
                  height: `${(item.value / Math.max(...valueByStatus.map(v => v.value))) * 100}%`,
                }}
                title={`${item.name}: $${(item.value / 1000).toFixed(0)}k`}
              />
              <p className="text-xs text-gray-600 mt-1 text-center">{item.name.split(' ')[0]}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
