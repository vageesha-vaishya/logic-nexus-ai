import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WidgetContainer } from '@/components/dashboard/WidgetContainer';
import { useTranslation } from 'react-i18next';
import { WidgetProps } from '@/types/dashboard';
import { useDashboardData, ActivityItem } from '@/hooks/useDashboardData';
import { CheckSquare, Phone, Calendar, Mail, StickyNote } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

export function ActivitiesWidget({ config, onRemove, onEdit }: WidgetProps) {
  const { t } = useTranslation();
  const { context, scopedDb } = useCRM();
  const { loading, myActivities, leadNamesById, setMyActivities } = useDashboardData();

  const renderTypeBadge = (t_type: string | null) => {
    const type = (t_type || '').toLowerCase();
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
      const { error } = await scopedDb
        .from('activities')
        .update({ assigned_to })
        .eq('id', activityId);
      if (error) throw error;
      
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
    <WidgetContainer
      title={config.title || (context.isPlatformAdmin ? t('Recent Activities') : t('My Activities'))}
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
                          {/* Note: In a real widget we might want to pass assignableUsers prop or fetch it here */}
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
  );
}
