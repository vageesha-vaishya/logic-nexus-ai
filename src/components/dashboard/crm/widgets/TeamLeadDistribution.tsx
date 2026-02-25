import React from 'react';
import { PieChart, Users, Zap } from 'lucide-react';

export function TeamLeadDistribution() {
  // Mock lead distribution data for demonstration
  const leadDistribution = [
    { name: 'Alice Johnson', leads: 24, percentage: 32 },
    { name: 'Bob Smith', leads: 18, percentage: 24 },
    { name: 'Carol White', leads: 22, percentage: 29 },
    { name: 'David Lee', leads: 10, percentage: 13 },
  ];

  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="h-5 w-5 text-indigo-600" />
        <h4 className="font-semibold text-gray-900">Lead Distribution</h4>
      </div>
      <div className="space-y-3">
        {leadDistribution.map((rep, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">{rep.name}</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{rep.leads}</span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{rep.percentage}%</span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${rep.percentage}%`,
                  backgroundColor: colors[idx % colors.length],
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="pt-3 border-t space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-indigo-600" />
          <p className="text-sm text-gray-600">
            Total Leads: <span className="font-semibold text-gray-900">74</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-600" />
          <p className="text-sm text-gray-600">
            Team Size: <span className="font-semibold text-gray-900">4</span>
          </p>
        </div>
      </div>
    </div>
  );
}
