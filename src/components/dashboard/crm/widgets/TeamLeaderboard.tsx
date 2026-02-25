import React from 'react';
import { Users, TrendingUp } from 'lucide-react';

export function TeamLeaderboard() {
  // Mock team data for demonstration
  const teamMembers = [
    { name: 'Alice Johnson', calls: 24, emails: 18, deals: 3, revenue: '$45,000' },
    { name: 'Bob Smith', calls: 19, emails: 22, deals: 2, revenue: '$32,000' },
    { name: 'Carol White', calls: 28, emails: 15, deals: 4, revenue: '$58,000' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">Team Performance</h4>
      </div>
      <div className="space-y-2">
        {teamMembers.map((member, idx) => (
          <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
            <div>
              <p className="font-medium text-gray-900">{member.name}</p>
              <p className="text-xs text-gray-500">{member.calls} calls • {member.emails} emails</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-green-600 font-semibold">
                <TrendingUp className="h-4 w-4" />
                {member.revenue}
              </div>
              <p className="text-xs text-gray-500">{member.deals} deals</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
