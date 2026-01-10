import { useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Phone, Calendar, CheckSquare, Mail, StickyNote } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCRM } from '@/hooks/useCRM';
import { Link } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAssignableUsers } from '@/hooks/useAssignableUsers';
import { toast } from 'sonner';
import { ScopedDataAccess, DataAccessContext } from '@/lib/db/access';
import { useDashboardData, ActivityItem } from '@/hooks/useDashboardData';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { WidgetContainer } from '@/components/dashboard/WidgetContainer';
import { useTranslation } from 'react-i18next';

export default function Dashboards() {
  const { t } = useTranslation();
  const { supabase, context } = useCRM();
  const { formatLabel } = useAssignableUsers();
  
  const { 
    loading, 
    myLeads, 
    myActivities, 
    assignableUsers, 
    leadNamesById, 
    setMyActivities,
    error
  } = useDashboardData();

  if (error) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('Error')}</AlertTitle>
            <AlertDescription>
              {t('Failed to load dashboard data. Please try refreshing the page.')}
              <br />
              <span className="text-xs opacity-70">{error.message}</span>
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

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

  const assignActivityOwner = async (activityId: string, newOwnerId: string | 'none') => {
    try {
      const assigned_to = newOwnerId === 'none' ? null : newOwnerId;
      const dao = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);
      const { error } = await dao
        .from('activities')
        .update({ assigned_to })
        .eq('id', activityId);
      if (error) throw error;
      // Optimistically update local state; remove items reassigned away from me
      setMyActivities((prev) => {
        const updated = prev.map((a) => (a.id === activityId ? { ...a, assigned_to } : a));
        return updated.filter((a) => a.assigned_to === context.userId);
      });
      toast.success(t('Activity assignment updated'));
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t('Failed to update assignment'));
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('Dashboards')}</h1>
          <p className="text-muted-foreground">{t('Your work at a glance')}</p>
        </div>

        {/* KPI Stats Cards */}
        <StatsCards loading={loading} />

        <div className="grid gap-4 md:grid-cols-2">
          {/* My Leads Widget */}
          <WidgetContainer
            title={t('My Leads')}
            action={
              <Button variant="link" className="p-0" asChild>
                <Link to="/dashboard/leads">{t('View all')}</Link>
              </Button>
            }
          >
            {loading ? (
              <p className="text-sm text-muted-foreground">{t('Loading...')}</p>
            ) : myLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('No assigned leads yet')}</p>
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
          </WidgetContainer>

          {/* My Activities Widget */}
          <WidgetContainer
            title={context.isPlatformAdmin ? t('Recent Activities') : t('My Activities')}
            action={
              <Button variant="link" className="p-0" asChild>
                <Link to="/dashboard/activities">{t('View all')}</Link>
              </Button>
            }
          >
            {loading ? (
              <p className="text-sm text-muted-foreground">{t('Loading...')}</p>
            ) : myActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('No upcoming tasks')}</p>
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
                    ? t('No Lead')
                    : (leadNamesById[groupId] ?? t('Lead'));
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
                                  {overdue ? t('Overdue') : (a.status ?? t('planned'))}
                                </Badge>
                                <Select
                                  onValueChange={(v) => assignActivityOwner(a.id, v as any)}
                                  defaultValue={a.assigned_to ?? 'none'}
                                >
                                  <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder={t('Assign To')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">{t('Unassigned')}</SelectItem>
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
          </WidgetContainer>
        </div>
      </div>
    </DashboardLayout>
  );
}
