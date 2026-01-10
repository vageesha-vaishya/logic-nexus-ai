import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, UserPlus, CheckSquare } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { KanbanDashboard } from '@/components/dashboard/KanbanDashboard';
import { useCRM } from '@/hooks/useCRM';
import { ScopedDataAccess, DataAccessContext } from '@/lib/db/access';

interface DashboardStats {
  accounts: number;
  leads: number;
  contacts: number;
  activities: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { supabase, context } = useCRM();
  const [stats, setStats] = useState<DashboardStats>({
    accounts: 0,
    leads: 0,
    contacts: 0,
    activities: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Create scoped data access for proper filtering
  const dao = useMemo(() => new ScopedDataAccess(supabase, context as unknown as DataAccessContext), [supabase, context]);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setLoading(true);
        
        // Use ScopedDataAccess to apply tenant/franchise filters
        const [accountsResult, leadsResult, contactsResult, activitiesResult] = await Promise.all([
          dao.from('accounts').select('*', { count: 'exact', head: true }),
          dao.from('leads').select('*', { count: 'exact', head: true }),
          dao.from('contacts').select('*', { count: 'exact', head: true }),
          dao.from('activities').select('*', { count: 'exact', head: true })
        ]);

        setStats({
          accounts: (accountsResult as any).count || 0,
          leads: (leadsResult as any).count || 0,
          contacts: (contactsResult as any).count || 0,
          activities: (activitiesResult as any).count || 0
        });
      } catch (error: any) {
        toast({
          title: 'Error',
          description: 'Failed to load dashboard statistics',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
    // Include context._version to trigger re-fetch when scope changes
  }, [dao, context.tenantId, context.franchiseId, context._version, toast]);

  const statCards = [
    {
      title: 'Total Accounts',
      value: loading ? '-' : stats.accounts.toString(),
      icon: Building2,
      change: '+0%',
      trend: 'up',
      path: '/dashboard/accounts'
    },
    {
      title: 'Active Leads',
      value: loading ? '-' : stats.leads.toString(),
      icon: UserPlus,
      change: '+0%',
      trend: 'up',
      path: '/dashboard/leads'
    },
    {
      title: 'Contacts',
      value: loading ? '-' : stats.contacts.toString(),
      icon: Users,
      change: '+0%',
      trend: 'up',
      path: '/dashboard/contacts'
    },
    {
      title: 'Activities',
      value: loading ? '-' : stats.activities.toString(),
      icon: CheckSquare,
      change: '+0%',
      trend: 'up',
      path: '/dashboard/activities'
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to SOSLogicPro CRM</p>
        </div>

        {/* Kanban Dashboard Overview */}
        <KanbanDashboard />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card 
                key={stat.title} 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(stat.path)}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">
                    <span className={stat.trend === 'up' ? 'text-green-500' : 'text-red-500'}>
                      {stat.change}
                    </span>{' '}
                    from last month
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>Your latest CRM activities</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">
                No recent activities
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pipeline Overview</CardTitle>
              <CardDescription>Sales pipeline status</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">
                No pipeline data
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
