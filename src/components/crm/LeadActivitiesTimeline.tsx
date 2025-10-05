import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, Phone, Mail, Calendar, CheckCircle2, Clock, Pencil, Trash2 } from 'lucide-react';
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

interface Activity {
  id: string;
  activity_type: string;
  subject: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
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

  useEffect(() => {
    fetchActivities();
  }, [leadId]);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (error: any) {
      toast.error('Failed to load activities');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
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

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-500';
      case 'in_progress':
        return 'bg-blue-500/10 text-blue-500';
      case 'planned':
        return 'bg-purple-500/10 text-purple-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/10 text-red-500';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'low':
        return 'bg-gray-500/10 text-gray-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  const handleDeleteClick = (activityId: string) => {
    setActivityToDelete(activityId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!activityToDelete) return;

    try {
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', activityToDelete);

      if (error) throw error;

      toast.success('Activity deleted successfully');
      setActivities(activities.filter(a => a.id !== activityToDelete));
    } catch (error: any) {
      toast.error('Failed to delete activity');
      console.error('Error:', error);
    } finally {
      setDeleteDialogOpen(false);
      setActivityToDelete(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Loading activities...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Activity Timeline</CardTitle>
            <CardDescription>Track all interactions with this lead</CardDescription>
          </div>
          <Button size="sm" onClick={() => navigate(`/dashboard/activities/new?leadId=${leadId}`)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Activity
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No activities recorded yet</p>
            <Button size="sm" className="mt-4" onClick={() => navigate(`/dashboard/activities/new?leadId=${leadId}`)}>
              <Plus className="mr-2 h-4 w-4" />
              Log First Activity
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <div
                key={activity.id}
                className="relative flex gap-4 pb-4 border-b last:border-0 last:pb-0"
              >
                {/* Timeline dot */}
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {getActivityIcon(activity.activity_type)}
                  </div>
                  {index !== activities.length - 1 && (
                    <div className="absolute left-1/2 top-10 h-full w-0.5 -translate-x-1/2 bg-border" />
                  )}
                </div>

                {/* Activity content */}
                <div className="flex-1 pt-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{activity.subject}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(activity.created_at), 'PPp')}
                      </p>
                    </div>
                    <div className="flex gap-2 items-start">
                      <Badge className={getStatusColor(activity.status)} variant="outline">
                        {activity.status ?? 'planned'}
                      </Badge>
                      <Badge className={getPriorityColor(activity.priority)} variant="outline">
                        {activity.priority ?? 'medium'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => navigate(`/dashboard/activities/${activity.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(activity.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {activity.due_date && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                      <Calendar className="h-3 w-3" />
                      Due: {format(new Date(activity.due_date), 'PP')}
                    </div>
                  )}
                  {activity.completed_at && (
                    <div className="flex items-center gap-1 text-xs text-green-600 mt-2">
                      <CheckCircle2 className="h-3 w-3" />
                      Completed: {format(new Date(activity.completed_at), 'PP')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this activity? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
