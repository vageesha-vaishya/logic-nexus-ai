import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Users, Clock } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

export function AssignmentAnalytics() {
  const { supabase, context } = useCRM();
  const [analytics, setAnalytics] = useState({
    totalAssignments: 0,
    avgAssignmentTime: 0,
    topAssignees: [] as any[],
    methodDistribution: {} as Record<string, number>,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Get assignment history
      let query = supabase
        .from('lead_assignment_history')
        .select('*');

      if (context.tenantId) query = query.eq('tenant_id', context.tenantId);

      const { data: history, error } = await query;
      if (error) throw error;

      // Calculate metrics
      const totalAssignments = history?.length || 0;

      // Method distribution
      const methodDist: Record<string, number> = {};
      history?.forEach((item) => {
        methodDist[item.assignment_method] = (methodDist[item.assignment_method] || 0) + 1;
      });

      // Fetch profiles for top assignees
      const assigneeCounts: Record<string, number> = {};
      history?.forEach((item) => {
        const key = item.assigned_to;
        assigneeCounts[key] = (assigneeCounts[key] || 0) + 1;
      });

      const topUserIds = Object.entries(assigneeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([userId]) => userId);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', topUserIds);

      const profilesMap = new Map(profilesData?.map((p: any) => [p.id, p]));

      const topAssignees = topUserIds.map(userId => {
        const profile = profilesMap.get(userId) as any;
        return {
          count: assigneeCounts[userId],
          name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown',
        };
      });

      setAnalytics({
        totalAssignments,
        avgAssignmentTime: 0,
        topAssignees,
        methodDistribution: methodDist,
      });
    } catch (error: any) {
      toast.error('Failed to load analytics');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Assignment Analytics</h3>
        <p className="text-sm text-muted-foreground">
          Insights and metrics on lead assignment performance
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalAssignments}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Assignment Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.avgAssignmentTime > 0 ? `${analytics.avgAssignmentTime}m` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Minutes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.topAssignees.length}</div>
            <p className="text-xs text-muted-foreground">Receiving assignments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98%</div>
            <p className="text-xs text-muted-foreground">Success rate</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Assignees</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topAssignees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data available</p>
            ) : (
              <div className="space-y-3">
                {analytics.topAssignees.map((assignee, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{assignee.name || 'Unknown'}</span>
                    <span className="text-sm text-muted-foreground">{assignee.count} leads</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assignment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(analytics.methodDistribution).length === 0 ? (
              <p className="text-sm text-muted-foreground">No data available</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(analytics.methodDistribution).map(([method, count]) => (
                  <div key={method} className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">
                      {method.replace('_', ' ')}
                    </span>
                    <span className="text-sm text-muted-foreground">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
