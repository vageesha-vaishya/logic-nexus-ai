import React from 'react';
import { Users, TrendingUp } from 'lucide-react';

export function SalesTeamSize() {
  const teamStats = {
    total: 24,
    managers: 3,
    executives: 4,
    reps: 17,
    growth: '+8%',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          <h4 className="font-semibold text-gray-900">Sales Team Size</h4>
        </div>
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm font-semibold">{teamStats.growth}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-2xl font-bold text-blue-900">{teamStats.total}</p>
          <p className="text-xs text-blue-700 mt-1">Total Team Members</p>
        </div>
        <div className="p-3 bg-purple-50 rounded border border-purple-200">
          <p className="text-2xl font-bold text-purple-900">{teamStats.managers}</p>
          <p className="text-xs text-purple-700 mt-1">Managers</p>
        </div>
        <div className="p-3 bg-green-50 rounded border border-green-200">
          <p className="text-2xl font-bold text-green-900">{teamStats.reps}</p>
          <p className="text-xs text-green-700 mt-1">Sales Reps</p>
        </div>
        <div className="p-3 bg-orange-50 rounded border border-orange-200">
          <p className="text-2xl font-bold text-orange-900">{teamStats.executives}</p>
          <p className="text-xs text-orange-700 mt-1">Executives</p>
        </div>
      </div>
    </div>
  );
}
