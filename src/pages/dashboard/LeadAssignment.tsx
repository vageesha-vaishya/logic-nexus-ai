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
import { CRMModuleHeaderNavigation } from '@/components/crm/CRMModuleHeaderNavigation';
import { themeStyleFromPreset } from '@/lib/theme-utils';
import { LeadsPrimaryView, useLeadsViewState } from '@/hooks/useLeadsViewState';

export default function LeadAssignment() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'rules';

  const { supabase, context, scopedDb } = useCRM();
  const { state: viewState, setTheme, setView, setPipeline } = useLeadsViewState();
  const currentTheme = viewState.theme;
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
  const handleThemeChange = (val: string) => {
    setTheme(val);
    try {
      localStorage.setItem('leadsTheme', val);
    } catch {
      return;
    }
  };

  const handleHeaderViewModeChange = (mode: LeadsPrimaryView) => {
    if (mode === 'pipeline') {
      try {
        localStorage.setItem('leadsViewMode', 'pipeline');
      } catch {
        void 0;
      }
      scopedDb.logViewPreference('leads', 'pipeline');
      setView('pipeline');
      setPipeline({ q: '', status: [], tab: 'board' });
      navigate('/dashboard/leads/pipeline');
      return;
    }

    try {
      localStorage.setItem('leadsViewMode', mode);
    } catch {
      void 0;
    }
    scopedDb.logViewPreference('leads', mode);
    setView(mode);
    navigate('/dashboard/leads');
  };

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
      const { count: queueCount } = await scopedDb
        .from('lead_assignment_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Fetch assignments today
      const { count: assignedCount } = await scopedDb
        .from('lead_assignment_history')
        .select('*', { count: 'exact', head: true })
        .gte('assigned_at', today.toISOString());

      // Fetch active rules
      const { count: rulesCount } = await scopedDb
        .from('lead_assignment_rules')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Fetch territories
      const { count: territoriesCount } = await scopedDb
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
      <div style={themeStyleFromPreset(currentTheme)} className="space-y-6 transition-colors duration-300">
        <div className="flex items-start justify-between gap-4 sm:items-center">
          <div>
            <h1 className="text-3xl font-bold">Lead Assignment</h1>
            <p className="text-muted-foreground">
              Manage automated lead distribution and assignment workflows
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <CRMModuleHeaderNavigation
              moduleLabel="Leads"
              viewMode="list"
              theme={currentTheme}
              onViewModeChange={(mode) => handleHeaderViewModeChange(mode as LeadsPrimaryView)}
              onThemeChange={handleThemeChange}
              onCreate={() => navigate('/dashboard/leads/new')}
              createLabel="New Lead"
              onRefresh={fetchStats}
              analyticsActive={false}
              onAnalyticsClick={() => {
                try {
                  localStorage.setItem('leadsViewMode', 'pipeline');
                } catch {
                  void 0;
                }
                scopedDb.logViewPreference('leads', 'pipeline');
                setView('pipeline');
                setPipeline({ q: '', status: [], tab: 'analytics' });
                navigate('/dashboard/leads/pipeline?view=analytics');
              }}
              onImportExport={() => navigate('/dashboard/leads/import-export')}
              controlSequence={['pipeline', 'list', 'create', 'card', 'grid', 'refresh', 'analytics', 'importExport', 'theme']}
              iconOnly
              layout="compact"
            />
            <Button onClick={handleProcessQueue}>
              <Play className="mr-2 h-4 w-4" />
              Process Queue
            </Button>
          </div>
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
