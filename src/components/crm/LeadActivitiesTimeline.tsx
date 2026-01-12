import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, Phone, Mail, Calendar, Clock, Pencil, Trash2, MousePointerClick, Eye, FileText, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  
  // Pagination & Filter State
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [hasMore, setHasMore] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  
  // Edit State
  const toggleExpanded = (activityId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  };

  const fetchActivities = useCallback(async () => {
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
  }, [filterType, leadId, page, supabase]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  useEffect(() => {
    const channel = supabase
      .channel(`lead-activities-${leadId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities', filter: `lead_id=eq.${leadId}` }, () => fetchActivities())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_activities', filter: `lead_id=eq.${leadId}` }, () => fetchActivities())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActivities, leadId, supabase]);

  const formatAutomatedSubject = (type: string, metadata: any) => {
    switch (type) {
        case 'email_opened': return 'Email Opened';
        case 'link_clicked': return 'Link Clicked';
        case 'page_view': return `Page View: ${metadata?.url || 'Unknown'}`;
        case 'form_submission': return 'Form Submission';
        case 'chatbot_message': return 'Chatbot Message';
        default: return type.replace(/_/g, ' ');
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch ((priority || '').toLowerCase()) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getActivityIcon = (type: string, isAutomated?: boolean) => {
    if (isAutomated) {
        switch (type) {
            case 'email_opened': return <Mail className="h-4 w-4 text-blue-500" />;
            case 'link_clicked': return <MousePointerClick className="h-4 w-4 text-purple-500" />;
            case 'page_view': return <Eye className="h-4 w-4 text-indigo-500" />;
            case 'form_submission': return <FileText className="h-4 w-4 text-green-500" />;
            default: return <Clock className="h-4 w-4 text-slate-500" />;
        }
    }
    switch (type) {
      case 'call': return <Phone className="h-4 w-4 text-blue-600" />;
      case 'email': return <Mail className="h-4 w-4 text-indigo-600" />;
      case 'meeting': return <Calendar className="h-4 w-4 text-orange-600" />;
      default: return <Clock className="h-4 w-4 text-slate-600" />;
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
    <Card className="border-none shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 px-0">
        <div>
          <CardTitle className="text-xl">Activity Timeline</CardTitle>
          <CardDescription>History of interactions and automated events</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={filterType}
            onValueChange={(val) => {
              setPage(1);
              setFilterType(val);
            }}
          >
            <SelectTrigger className="h-9 w-[150px] bg-background" aria-label="Filter activities">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">All Activities</SelectItem>
              <SelectItem value="call">Calls</SelectItem>
              <SelectItem value="email">Emails</SelectItem>
              <SelectItem value="meeting">Meetings</SelectItem>
              <SelectItem value="task">Tasks</SelectItem>
              <SelectItem value="note">Notes</SelectItem>
              <SelectItem value="automated">Automated</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="h-9" onClick={() => navigate(`/dashboard/activities/new?leadId=${leadId}`)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Activity
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Clock className="h-8 w-8 mb-2 animate-pulse" />
            <p>Loading timeline...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
            <div className="h-12 w-12 rounded-full bg-muted/20 flex items-center justify-center mb-4">
              <Clock className="h-6 w-6 opacity-50" />
            </div>
            <p className="font-medium mb-1">No activities found</p>
            <p className="text-sm mb-4">Get started by creating a new activity</p>
            <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/activities/new?leadId=${leadId}`)}>
              Create Activity
            </Button>
          </div>
        ) : (
          <div className="relative space-y-0 before:absolute before:inset-0 before:ml-6 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border before:to-transparent">
            {activities.map((activity, index) => (
              <div key={activity.id} className="relative flex gap-6 pb-8 last:pb-0 group">
                <div className="absolute left-6 -translate-x-1/2 mt-1.5 h-3 w-3 rounded-full border-2 border-background bg-muted-foreground ring-4 ring-background group-hover:bg-primary transition-colors" />
                
                <div className="flex-1 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md ml-6">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 ${activity.is_automated ? 'text-blue-500' : 'text-primary'}`}>
                        {getActivityIcon(activity.activity_type, activity.is_automated)}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                          {activity.subject}
                          {activity.is_automated ? (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal rounded-full">Automated</Badge>
                          ) : (
                            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 font-normal capitalize rounded-full ${getPriorityColor(activity.priority)}`}>
                              {activity.priority || 'Normal'}
                            </Badge>
                          )}
                        </div>
                        <time className="text-xs text-muted-foreground">
                          {format(new Date(activity.created_at), 'PPP p')}
                        </time>
                      </div>
                    </div>
                    
                    {!activity.is_automated && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate(`/dashboard/activities/${activity.id}`)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            setActivityToDelete(activity.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground pl-[44px]">
                    {activity.is_automated ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs">
                           <span className="font-medium capitalize text-foreground">{activity.activity_type.replace(/_/g, ' ')}</span>
                           {activity.metadata?.url && <span className="text-muted-foreground truncate max-w-[300px]">— {activity.metadata.url}</span>}
                        </div>
                        {activity.metadata && (
                          <div className="mt-2">
                             <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 px-2 text-xs"
                                onClick={() => toggleExpanded(activity.id)}
                             >
                               {expanded.has(activity.id) ? 'Hide Details' : 'View Details'}
                             </Button>
                             {expanded.has(activity.id) && (
                                <div className="mt-2 bg-muted/50 p-3 rounded-lg text-xs font-mono overflow-x-auto">
                                  <pre>{JSON.stringify(activity.metadata, null, 2)}</pre>
                                </div>
                             )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activity.description && (
                          <div className={`text-sm leading-relaxed ${!expanded.has(activity.id) ? 'line-clamp-2' : ''}`}>
                            {activity.description}
                          </div>
                        )}
                        
                        {(activity.description?.length || 0) > 100 && (
                          <Button 
                            variant="link" 
                            className="h-auto p-0 text-xs text-primary"
                            onClick={() => toggleExpanded(activity.id)}
                          >
                            {expanded.has(activity.id) ? 'Show less' : 'Show more'}
                          </Button>
                        )}

                        <div className="flex flex-wrap gap-2 mt-2">
                           <Badge variant="secondary" className="h-5 font-normal bg-muted text-muted-foreground">
                             {activity.status || 'Pending'}
                           </Badge>
                           {activity.custom_fields?.to && (
                             <Badge variant="outline" className="h-5 font-normal border-dashed">
                               To: {activity.custom_fields.to}
                             </Badge>
                           )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm font-medium min-w-[3rem] text-center">Page {page}</span>
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
