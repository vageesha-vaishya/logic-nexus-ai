import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCRM } from '@/hooks/useCRM';
import { Link } from 'react-router-dom';

interface LeadItem {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  status: string;
  owner_id: string | null;
}

interface ActivityItem {
  id: string;
  activity_type: string;
  subject: string | null;
  due_date: string | null;
  status: string | null;
  assigned_to: string | null;
  lead_id: string | null;
}

export default function Dashboards() {
  const { supabase, context } = useCRM();
  const [loading, setLoading] = useState(true);
  const [myLeads, setMyLeads] = useState<LeadItem[]>([]);
  const [myActivities, setMyActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // My Leads: assigned to me
        let leadQuery = supabase
          .from('leads')
          .select('id, first_name, last_name, company, status, owner_id')
          .eq('owner_id', context.userId)
          .order('created_at', { ascending: false })
          .limit(6);

        // Scope by tenant/franchise when available to respect RLS
        if (context.franchiseId) {
          leadQuery = leadQuery.eq('franchise_id', context.franchiseId);
        } else if (context.tenantId) {
          leadQuery = leadQuery.eq('tenant_id', context.tenantId);
        }

        const { data: leads, error: leadsErr } = await leadQuery;
        if (leadsErr) throw leadsErr;
        setMyLeads(leads || []);

        // My Activities: assigned to me and not completed
        let actQuery = supabase
          .from('activities')
          .select('id, activity_type, subject, due_date, status, assigned_to, lead_id')
          .eq('assigned_to', context.userId)
          .neq('status', 'completed')
          .order('due_date', { ascending: true })
          .limit(6);

        if (context.franchiseId) {
          actQuery = actQuery.eq('franchise_id', context.franchiseId);
        } else if (context.tenantId) {
          actQuery = actQuery.eq('tenant_id', context.tenantId);
        }

        const { data: activities, error: actErr } = await actQuery;
        if (actErr) throw actErr;
        setMyActivities((activities || []) as ActivityItem[]);
      } catch (e) {
        console.error('Dashboard fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase, context.userId, context.tenantId, context.franchiseId]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboards</h1>
          <p className="text-muted-foreground">Your work at a glance</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>My Leads</CardTitle>
              <Button variant="link" className="p-0" asChild>
                <Link to="/dashboard/leads">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : myLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assigned leads yet</p>
              ) : (
                <ul className="space-y-3">
                  {myLeads.map((l) => (
                    <li key={l.id} className="flex items-center justify-between">
                      <div>
                        <Link to={`/dashboard/leads/${l.id}`} className="font-medium hover:underline">
                          {l.first_name} {l.last_name}
                        </Link>
                        {l.company && (
                          <span className="ml-2 text-sm text-muted-foreground">· {l.company}</span>
                        )}
                      </div>
                      <Badge variant="secondary">{l.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>My Activities</CardTitle>
              <Button variant="link" className="p-0" asChild>
                <Link to="/dashboard/activities">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : myActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming tasks</p>
              ) : (
                <ul className="space-y-3">
                  {myActivities.map((a) => {
                    const overdue = a.due_date ? new Date(a.due_date) < new Date() : false;
                    return (
                      <li key={a.id} className="flex items-center justify-between">
                        <div>
                          <Link to={`/dashboard/activities/${a.id}`} className="font-medium hover:underline">
                            {a.subject || a.activity_type}
                          </Link>
                          {a.due_date && (
                            <span className={`ml-2 text-sm ${overdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                              {new Date(a.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <Badge variant={overdue ? 'destructive' : 'secondary'}>
                          {overdue ? 'Overdue' : (a.status ?? 'planned')}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}