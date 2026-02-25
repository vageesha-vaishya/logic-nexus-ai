import React from 'react';
import { Target, TrendingUp, Users } from 'lucide-react';

export function TeamQuotaProgress() {
  const teamQuotaData = {
    teamTarget: 850000,
    teamActual: 756200,
    achievement: 88.9,
    trend: '+12%',
    members: [
      { name: 'Alex Chen', target: 150000, actual: 145600, achievement: 97.1, status: 'On Track' },
      { name: 'Jordan Davis', target: 150000, actual: 168300, achievement: 112.2, status: 'Exceeding' },
      { name: 'Sarah Miller', target: 150000, actual: 112400, achievement: 74.9, status: 'Below' },
      { name: 'Mike Thompson', target: 150000, actual: 158900, achievement: 105.9, status: 'Exceeding' },
      { name: 'Lisa Anderson', target: 150000, actual: 171000, achievement: 114.0, status: 'Exceeding' },
    ],
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Exceeding':
        return 'text-green-700 bg-green-100';
      case 'On Track':
        return 'text-blue-700 bg-blue-100';
      case 'Below':
        return 'text-red-700 bg-red-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  const getProgressColor = (achievement: number) => {
    if (achievement >= 100) return 'bg-gradient-to-r from-green-500 to-green-600';
    if (achievement >= 80) return 'bg-gradient-to-r from-blue-500 to-blue-600';
    return 'bg-gradient-to-r from-orange-500 to-orange-600';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-600" />
          <h4 className="font-semibold text-gray-900">Team Quota Progress</h4>
        </div>
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm font-semibold">{teamQuotaData.trend}</span>
        </div>
      </div>

      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded border border-blue-200">
        <p className="text-sm text-blue-700 mb-1">Team Quota Achievement</p>
        <p className="text-3xl font-bold text-blue-900 mb-3">{teamQuotaData.achievement}%</p>
        <div className="w-full bg-blue-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all"
            style={{ width: `${teamQuotaData.achievement}%` }}
          />
        </div>
        <p className="text-xs text-blue-700 mt-2">
          ${(teamQuotaData.teamActual / 1000000).toFixed(2)}M / ${(teamQuotaData.teamTarget / 1000000).toFixed(2)}M
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-700">Team Members Performance</p>
        {teamQuotaData.members.map((member, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">{member.name}</p>
              <span className={`text-xs font-semibold px-2 py-1 rounded ${getStatusColor(member.status)}`}>
                {member.achievement.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${getProgressColor(member.achievement)}`}
                  style={{
                    width: `${Math.min(member.achievement, 120)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 w-12 text-right">${(member.actual / 1000).toFixed(0)}k</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
