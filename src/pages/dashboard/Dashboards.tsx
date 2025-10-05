import { useEffect, useState } from 'react';
import { Phone, Calendar, CheckSquare, Mail, StickyNote } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCRM } from '@/hooks/useCRM';
import { Link } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAssignableUsers, AssignableUser } from '@/hooks/useAssignableUsers';
import { toast } from 'sonner';

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
  const { fetchAssignableUsers, formatLabel } = useAssignableUsers();
  const [loading, setLoading] = useState(true);
  const [myLeads, setMyLeads] = useState<LeadItem[]>([]);
  const [myActivities, setMyActivities] = useState<ActivityItem[]>([]);
  const [leadNamesById, setLeadNamesById] = useState<Record<string, string>>({});
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);

  const renderTypeBadge = (t: string | null) => {
    const type = (t || '').toLowerCase();
    const map: Record<string, { label: string; icon?: any }> = {
      task: { label: 'Task', icon: CheckSquare },
      call: { label: 'Call', icon: Phone },
      meeting: { label: 'Meeting', icon: Calendar },
      email: { label: 'Email', icon: Mail },
      note: { label: 'Note', icon: StickyNote },
    };
    const meta = map[type];
    const label = meta?.label || (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Activity');
    const Icon = meta?.icon;
    return (
      <Badge variant="outline" className="ml-2 text-xs">
        {Icon ? <Icon className="mr-1 h-3 w-3" /> : null}
        {label}
      </Badge>
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch assignable users for inline assignment control
        const { data: users } = await fetchAssignableUsers({ search: '', limit: 50 });
        setAssignableUsers((users ?? []) as AssignableUser[]);
        // My Leads: assigned to me
        let leadQuery = supabase
          .from('leads')
          .select('id, first_name, last_name, company, status, owner_id')
          .eq('owner_id', context.userId)
          .order('created_at', { ascending: false })
          .limit(6);

        // Rely on RLS for scoping; avoid extra filters that can exclude rows

        const { data: leads, error: leadsErr } = await leadQuery;
        if (leadsErr) throw leadsErr;
        setMyLeads(leads || []);

        // My Activities: assigned to me and not completed
        let actQuery = supabase
          .from('activities')
          .select('id, activity_type, subject, due_date, status, assigned_to, lead_id')
          .eq('assigned_to', context.userId)
          .or('status.is.null,status.neq.completed')
          .order('due_date', { ascending: true })
          .limit(6);
        // Rely on RLS for scoping; avoid extra filters that can exclude rows

        const { data: activities, error: actErr } = await actQuery;
        if (actErr) throw actErr;
        const acts = (activities || []) as ActivityItem[];
        setMyActivities(acts);

        // Fetch lead names for referenced activities to use as group headers
        const leadIds = Array.from(
          new Set(
            acts
              .map((a) => a.lead_id)
              .filter((id): id is string => !!id)
          )
        );
        if (leadIds.length > 0) {
          const { data: leadRefs, error: leadRefsErr } = await supabase
            .from('leads')
            .select('id, first_name, last_name, company')
            .in('id', leadIds);
          if (!leadRefsErr && leadRefs) {
            const map: Record<string, string> = {};
            for (const l of leadRefs) {
              const fullName = [l.first_name, l.last_name].filter(Boolean).join(' ').trim();
              map[l.id] = fullName || l.company || 'Lead';
            }
            setLeadNamesById(map);
          }
        } else {
          setLeadNamesById({});
        }
      } catch (e) {
        console.error('Dashboard fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase, context.userId, context.tenantId, context.franchiseId, fetchAssignableUsers]);

  const assignActivityOwner = async (activityId: string, newOwnerId: string | 'none') => {
    try {
      const assigned_to = newOwnerId === 'none' ? null : newOwnerId;
      const { error } = await supabase
        .from('activities')
        .update({ assigned_to })
        .eq('id', activityId);
      if (error) throw error;
      // Optimistically update local state; remove items reassigned away from me
      setMyActivities((prev) => {
        const updated = prev.map((a) => (a.id === activityId ? { ...a, assigned_to } : a));
        return updated.filter((a) => a.assigned_to === context.userId);
      });
      toast.success('Activity assignment updated');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to update assignment');
    }
  };

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
                <div className="space-y-4">
                  {Object.entries(
                    myActivities.reduce<Record<string, ActivityItem[]>>((acc, a) => {
                      const key = a.lead_id ?? 'none';
                      if (!acc[key]) acc[key] = [];
                      acc[key].push(a);
                      return acc;
                    }, {})
                  ).map(([groupId, items]) => {
                    const isNone = groupId === 'none';
                    const headerLabel = isNone
                      ? 'No Lead'
                      : (leadNamesById[groupId] ?? 'Lead');
                    return (
                      <div key={groupId} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-muted-foreground">
                            {isNone ? (
                              headerLabel
                            ) : (
                              <Link to={`/dashboard/leads/${groupId}`} className="hover:underline">
                                {headerLabel}
                              </Link>
                            )}
                          </div>
                        </div>
                        <ul className="space-y-3">
                          {items.map((a) => {
                            const overdue = a.due_date ? new Date(a.due_date) < new Date() : false;
                            return (
                              <li key={a.id} className="flex items-center justify-between">
                                <div>
                                  <Link to={`/dashboard/activities/${a.id}`} className="font-medium hover:underline">
                                    {a.subject || a.activity_type}
                                  </Link>
                                  {/* Show activity type label */}
                                  {renderTypeBadge(a.activity_type)}
                                  {a.due_date && (
                                    <span className={`ml-2 text-sm ${overdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                                      {new Date(a.due_date).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={overdue ? 'destructive' : 'secondary'}>
                                    {overdue ? 'Overdue' : (a.status ?? 'planned')}
                                  </Badge>
                                  <Select
                                    onValueChange={(v) => assignActivityOwner(a.id, v as any)}
                                    defaultValue={a.assigned_to ?? 'none'}
                                  >
                                    <SelectTrigger className="w-[180px]">
                                      <SelectValue placeholder="Assign To" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Unassigned</SelectItem>
                                      {assignableUsers.map((u) => (
                                        <SelectItem key={u.id} value={u.id}>{formatLabel(u)}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}