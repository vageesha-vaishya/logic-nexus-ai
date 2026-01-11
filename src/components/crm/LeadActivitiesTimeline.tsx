import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, Phone, Mail, Calendar, Clock, Pencil, Trash2, MousePointerClick, Eye, FileText, ChevronLeft, ChevronRight, StickyNote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ActivityForm } from './ActivityForm';

interface Activity {
  id: string;
  activity_type: string;
  subject: string | null;
  description?: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  is_automated?: boolean;
  metadata?: any;
  custom_fields?: any;
}

interface LeadActivitiesTimelineProps {
  leadId: string;
}

export function LeadActivitiesTimeline({ leadId }: LeadActivitiesTimelineProps) {
  const { supabase } = useCRM();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<string | null>(null);
  
  // Pagination & Filter State
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [hasMore, setHasMore] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  
  // Edit State
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, [leadId, supabase, page, filterType]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      
      // Calculate pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Base query for manual activities
      let query = supabase
        .from('activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (filterType !== 'all' && filterType !== 'automated') {
        query = query.eq('activity_type', filterType as any);
      }

      const { data: manualData, error: manualError } = await query;

      if (manualError) throw manualError;

      // Base query for automated activities
      let automatedActivitiesData: any[] = [];
      if (filterType === 'all' || filterType === 'automated') {
         const { data, error } = await supabase
          .from('lead_activities' as any)
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false })
          .range(from, to);
         
         if (error) throw error;
         automatedActivitiesData = data || [];
      }

      const formattedManual = (manualData || []).map(a => ({
        ...a,
        is_automated: false
      }));

      const formattedAutomated = (automatedActivitiesData || []).map((a: any) => ({
        id: a.id,
        activity_type: a.type,
        subject: formatAutomatedSubject(a.type, a.metadata),
        status: 'completed',
        priority: 'low',
        due_date: null,
        completed_at: a.created_at,
        created_at: a.created_at,
        is_automated: true,
        metadata: a.metadata
      }));

      const combined = [...formattedManual, ...formattedAutomated].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setActivities(combined);
      setHasMore(manualData?.length === pageSize || automatedActivitiesData?.length === pageSize);

    } catch (error: any) {
      toast.error('Failed to load activities');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAutomatedSubject = (type: string, metadata: any) => {
    switch (type) {
        case 'email_opened': return 'Email Opened';
        case 'link_clicked': return 'Link Clicked';
        case 'page_view': return `Page View: ${metadata?.url || 'Unknown'}`;
        case 'form_submission': return 'Form Submission';
        default: return type.replace(/_/g, ' ');
    }
  };

  const getActivityIcon = (type: string, isAutomated?: boolean) => {
    if (isAutomated) {
        switch (type) {
            case 'email_opened': return <Mail className="h-4 w-4" />;
            case 'link_clicked': return <MousePointerClick className="h-4 w-4" />;
            case 'page_view': return <Eye className="h-4 w-4" />;
            case 'form_submission': return <FileText className="h-4 w-4" />;
            default: return <Clock className="h-4 w-4" />;
        }
    }
    switch (type) {
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'meeting':
        return <Calendar className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const handleDelete = async () => {
    if (!activityToDelete) return;

    try {
      // Hard delete since deleted_at column doesn't exist
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', activityToDelete);

      if (error) throw error;

      setActivities(activities.filter(a => a.id !== activityToDelete));
      toast.success('Activity deleted');
    } catch (error) {
      console.error('Error deleting activity:', error);
      toast.error('Failed to delete activity');
    } finally {
      setDeleteDialogOpen(false);
      setActivityToDelete(null);
    }
  };

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>History of interactions and automated events</CardDescription>
        </div>
        <Button size="sm" onClick={() => navigate(`/dashboard/activities/new?leadId=${leadId}`)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Activity
        </Button>
      </CardHeader>
      <CardContent className="mt-4">
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">Loading activities...</div>
        ) : activities.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">No activities found</div>
        ) : (
          <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
            {activities.map((activity) => (
              <div key={activity.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                  {getActivityIcon(activity.activity_type, activity.is_automated)}
                </div>
                
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded border shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{activity.subject}</span>
                      {activity.is_automated && <Badge variant="secondary" className="text-xs">Automated</Badge>}
                    </div>
                    <time className="font-caveat font-medium text-amber-500">
                      {format(new Date(activity.created_at), 'PP p')}
                    </time>
                  </div>
                  <div className="text-gray-500 text-sm mb-2">
                    {activity.is_automated ? (
                        <span>
                            Type: {activity.activity_type}
                            {activity.metadata?.url && ` - ${activity.metadata.url}`}
                        </span>
                    ) : (
                        <div className="space-y-1">
                          <div>{activity.status} • {activity.priority} priority</div>
                          {activity.custom_fields?.to && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-semibold">To:</span> {activity.custom_fields.to}
                            </div>
                          )}
                          {activity.custom_fields?.from && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-semibold">From:</span> {activity.custom_fields.from}
                            </div>
                          )}
                          {activity.description && (
                            <div className="mt-2 text-gray-700 bg-slate-50 p-2 rounded text-sm whitespace-pre-wrap">
                              {activity.description}
                            </div>
                          )}
                        </div>
                    )}
                  </div>
                  
                  {!activity.is_automated && (
                    <div className="flex gap-2 mt-2 justify-end">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigate(`/dashboard/activities/${activity.id}`)}>
                            <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600" onClick={() => {
                            setActivityToDelete(activity.id);
                            setDeleteDialogOpen(true);
                        }}>
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore || loading}
          >
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the activity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}