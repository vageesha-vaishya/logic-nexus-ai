import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Users, TrendingUp } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  calls: number;
  emails: number;
  deals: number;
  revenue: number;
}

export function TeamLeaderboard() {
  const { scopedDb } = useCRM();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeamPerformance = async () => {
      try {
        setLoading(true);

        // Get profiles to get user names
        const { data: profiles } = await scopedDb
          .from('profiles')
          .select('id, full_name')
          .limit(10);

        if (profiles && profiles.length > 0) {
          // Get activities for each user
          const teamData: TeamMember[] = [];

          for (const profile of profiles) {
            const { count: callsCount } = await scopedDb
              .from('activities')
              .select('*', { count: 'exact', head: true })
              .eq('type', 'call')
              .eq('created_by', profile.id);

            const { count: emailsCount } = await scopedDb
              .from('activities')
              .select('*', { count: 'exact', head: true })
              .eq('type', 'email')
              .eq('created_by', profile.id);

            const { data: opportunities } = await scopedDb
              .from('opportunities')
              .select('amount')
              .eq('assigned_to', profile.id);

            const dealCount = opportunities?.filter(o => o.amount).length || 0;
            const revenue = opportunities?.reduce((sum: number, o: any) => sum + (o.amount || 0), 0) || 0;

            teamData.push({
              id: profile.id,
              name: profile.full_name || 'Unknown',
              calls: callsCount || 0,
              emails: emailsCount || 0,
              deals: dealCount,
              revenue,
            });
          }

          // Sort by revenue descending
          teamData.sort((a, b) => b.revenue - a.revenue);
          setTeamMembers(teamData.slice(0, 5)); // Top 5
        }
      } catch (error) {
        console.error('Failed to fetch team performance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamPerformance();
  }, [scopedDb]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-blue-600" />
          <h4 className="font-semibold text-gray-900">Team Performance</h4>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">Team Performance</h4>
      </div>
      <div className="space-y-2">
        {teamMembers.length > 0 ? (
          teamMembers.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
              <div>
                <p className="font-medium text-gray-900">{member.name}</p>
                <p className="text-xs text-gray-500">
                  {member.calls} calls • {member.emails} emails
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-green-600 font-semibold">
                  <TrendingUp className="h-4 w-4" />
                  ${member.revenue.toLocaleString()}
                </div>
                <p className="text-xs text-gray-500">{member.deals} deals</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center py-4 text-gray-500">No team data available</p>
        )}
      </div>
    </div>
  );
}
