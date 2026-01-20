import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, MapPin, Settings, History, BarChart3, 
  Play, Pause, RefreshCw, UserPlus 
} from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { invokeFunction } from '@/lib/supabase-functions';
import { toast } from 'sonner';
import { AssignmentRules } from '@/components/assignment/AssignmentRules';
import { TerritoryManagement } from '@/components/assignment/TerritoryManagement';
import { UserCapacity } from '@/components/assignment/UserCapacity';
import { AssignmentQueue } from '@/components/assignment/AssignmentQueue';
import { AssignmentHistory } from '@/components/assignment/AssignmentHistory';
import { AssignmentAnalytics } from '@/components/assignment/AssignmentAnalytics';

export default function LeadAssignment() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'rules';

  const { supabase, context } = useCRM();
  const [stats, setStats] = useState({
    pendingQueue: 0,
    assignedToday: 0,
    activeRules: 0,
    territories: 0,
  });

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();

    // Subscribe to changes
    const channel = supabase
      .channel('lead-assignment-stats')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_assignment_queue'
        },
        () => {
          fetchStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_assignment_history'
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch queue count
      const { count: queueCount } = await supabase
        .from('lead_assignment_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Fetch assignments today
      const { count: assignedCount } = await supabase
        .from('lead_assignment_history')
        .select('*', { count: 'exact', head: true })
        .gte('assigned_at', today.toISOString());

      // Fetch active rules
      const { count: rulesCount } = await supabase
        .from('lead_assignment_rules')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Fetch territories
      const { count: territoriesCount } = await supabase
        .from('territories')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      setStats({
        pendingQueue: queueCount || 0,
        assignedToday: assignedCount || 0,
        activeRules: rulesCount || 0,
        territories: territoriesCount || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessQueue = async () => {
    try {
      toast.info('Processing assignment queue...');
      // Trigger edge function to process queue
      const { error } = await invokeFunction('process-lead-assignments');
      
      if (error) throw error;
      
      toast.success('Queue processing initiated');
      fetchStats();
    } catch (error: any) {
      toast.error('Failed to process queue');
      console.error('Error:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Lead Assignment</h1>
            <p className="text-muted-foreground">
              Manage automated lead distribution and assignment workflows
            </p>
          </div>
          <Button onClick={handleProcessQueue}>
            <Play className="mr-2 h-4 w-4" />
            Process Queue
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Queue</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingQueue}</div>
              <p className="text-xs text-muted-foreground">
                Leads waiting for assignment
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned Today</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.assignedToday}</div>
              <p className="text-xs text-muted-foreground">
                Leads assigned today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeRules}</div>
              <p className="text-xs text-muted-foreground">
                Assignment rules enabled
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Territories</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.territories}</div>
              <p className="text-xs text-muted-foreground">
                Active territories
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different sections */}
        <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList>
            <TabsTrigger value="rules">
              <Settings className="mr-2 h-4 w-4" />
              Assignment Rules
            </TabsTrigger>
            <TabsTrigger value="territories">
              <MapPin className="mr-2 h-4 w-4" />
              Territories
            </TabsTrigger>
            <TabsTrigger value="capacity">
              <Users className="mr-2 h-4 w-4" />
              User Capacity
            </TabsTrigger>
            <TabsTrigger value="queue">
              <RefreshCw className="mr-2 h-4 w-4" />
              Queue
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="mr-2 h-4 w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="space-y-4">
            <AssignmentRules onUpdate={fetchStats} />
          </TabsContent>

          <TabsContent value="territories" className="space-y-4">
            <TerritoryManagement />
          </TabsContent>

          <TabsContent value="capacity" className="space-y-4">
            <UserCapacity />
          </TabsContent>

          <TabsContent value="queue" className="space-y-4">
            <AssignmentQueue onUpdate={fetchStats} />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <AssignmentHistory />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <AssignmentAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
