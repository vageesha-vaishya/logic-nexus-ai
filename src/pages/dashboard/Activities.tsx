import { useState, useEffect } from 'react';
import { Plus, Search, Phone, Mail, Calendar, CheckSquare, FileText, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCRM } from '@/hooks/useCRM';
import { useAssignableUsers, AssignableUser } from '@/hooks/useAssignableUsers';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format, isToday, isFuture, isPast, startOfDay } from 'date-fns';

interface Activity {
  id: string;
  activity_type: string;
  status: string;
  priority: string;
  subject: string;
  description: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  account_id: string | null;
  contact_id: string | null;
  lead_id: string | null;
  assigned_to: string | null;
}

export default function Activities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const { supabase, context } = useCRM();
  const { fetchAssignableUsers, formatLabel } = useAssignableUsers();
  const [typeFilter, setTypeFilter] = useState<'any' | 'email' | 'call' | 'task' | 'meeting' | 'note'>('any');
  const [ownerFilter, setOwnerFilter] = useState<'any' | 'unassigned' | 'me' | string>('any');
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchActivities();
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await fetchAssignableUsers({
        search: '',
        limit: 100,
      });
      setAssignableUsers(data || []);
    };
    fetchUsers();
  }, [fetchAssignableUsers]);

  useEffect(() => {
    const firstTimeKey = 'activitiesHelpShown';
    const hasSeen = localStorage.getItem(firstTimeKey);
    if (!hasSeen) {
      setShowHelp(true);
    }
  }, []);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (error: any) {
      toast.error('Failed to load activities');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkComplete = async (activityId: string) => {
    try {
      const { error } = await supabase
        .from('activities')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', activityId);

      if (error) throw error;

      toast.success('Activity marked as completed');
      fetchActivities();
    } catch (error: any) {
      toast.error('Failed to update activity');
      console.error('Error:', error);
    }
  };

  const filterActivitiesByTab = (activities: Activity[]) => {
    const now = startOfDay(new Date());
    
    switch (activeTab) {
      case 'overdue':
        return activities.filter(
          a => a.status !== 'completed' && a.status !== 'cancelled' && 
          a.due_date && isPast(new Date(a.due_date)) && !isToday(new Date(a.due_date))
        );
      case 'today':
        return activities.filter(
          a => a.status !== 'completed' && a.status !== 'cancelled' &&
          a.due_date && isToday(new Date(a.due_date))
        );
      case 'upcoming':
        return activities.filter(
          a => a.status !== 'completed' && a.status !== 'cancelled' &&
          a.due_date && isFuture(new Date(a.due_date)) && !isToday(new Date(a.due_date))
        );
      case 'completed':
        return activities.filter(a => a.status === 'completed');
      default:
        return activities;
    }
  };

  const filteredActivities = filterActivitiesByTab(activities)
    .filter(activity => activity.subject.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(activity => typeFilter === 'any' ? true : activity.activity_type === typeFilter)
    .filter(activity => {
      if (ownerFilter === 'any') return true;
      if (ownerFilter === 'unassigned') return activity.assigned_to === null;
      if (ownerFilter === 'me') return activity.assigned_to === (context?.userId || null);
      return activity.assigned_to === ownerFilter;
    });

  const getTabCounts = () => {
    const now = startOfDay(new Date());
    return {
      all: activities.length,
      overdue: activities.filter(
        a => a.status !== 'completed' && a.status !== 'cancelled' &&
        a.due_date && isPast(new Date(a.due_date)) && !isToday(new Date(a.due_date))
      ).length,
      today: activities.filter(
        a => a.status !== 'completed' && a.status !== 'cancelled' &&
        a.due_date && isToday(new Date(a.due_date))
      ).length,
      upcoming: activities.filter(
        a => a.status !== 'completed' && a.status !== 'cancelled' &&
        a.due_date && isFuture(new Date(a.due_date)) && !isToday(new Date(a.due_date))
      ).length,
      completed: activities.filter(a => a.status === 'completed').length,
    };
  };

  const counts = getTabCounts();

  const getActivityIcon = (type: string) => {
    const icons: Record<string, any> = {
      call: Phone,
      email: Mail,
      meeting: Calendar,
      task: CheckSquare,
      note: FileText,
    };
    return icons[type] || CheckSquare;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planned: 'bg-blue-500/10 text-blue-500',
      in_progress: 'bg-yellow-500/10 text-yellow-500',
      completed: 'bg-green-500/10 text-green-500',
      cancelled: 'bg-red-500/10 text-red-500',
    };
    return colors[status] || 'bg-gray-500/10 text-gray-500';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: 'bg-red-500/10 text-red-500',
      high: 'bg-orange-500/10 text-orange-500',
      medium: 'bg-blue-500/10 text-blue-500',
      low: 'bg-gray-500/10 text-gray-500',
    };
    return colors[priority] || 'bg-gray-500/10 text-gray-500';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Activities</h1>
          <p className="text-muted-foreground">Manage your tasks and activities</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/activities/new?type=email">
              <Mail className="mr-2 h-4 w-4" />
              Email
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/activities/new?type=call">
              <Phone className="mr-2 h-4 w-4" />
              Call
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/activities/new?type=task">
              <CheckSquare className="mr-2 h-4 w-4" />
              Task
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/activities/new?type=event">
              <Calendar className="mr-2 h-4 w-4" />
              Event
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard/activities/new?type=note">
              <FileText className="mr-2 h-4 w-4" />
              Note
            </Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard/activities/new">
              <Plus className="mr-2 h-4 w-4" />
              New
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-40">
                <div className="text-xs text-muted-foreground mb-1">Type</div>
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Type</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="meeting">Event</SelectItem>
                    <SelectItem value="note">Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-56">
                <div className="text-xs text-muted-foreground mb-1">Owner</div>
                <Select value={ownerFilter} onValueChange={(v) => setOwnerFilter(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Owner</SelectItem>
                    <SelectItem value="me">My Activities</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {assignableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{formatLabel(u)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {showHelp && (
            <div className="mb-4 rounded-md border p-3 bg-muted/30 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium">Tip: Quickly manage activities</div>
                <div className="text-sm text-muted-foreground">
                  Use the <span className="font-medium">Type</span> and <span className="font-medium">Owner</span> filters to refine the list. 
                  Use the quick <span className="font-medium">New</span> buttons to instantly create Email, Call, Task, Event, or Note.
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  localStorage.setItem('activitiesHelpShown', '1');
                  setShowHelp(false);
                }}
              >
                Got it
              </Button>
            </div>
          )}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all" className="relative">
                All
                {counts.all > 0 && (
                  <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">
                    {counts.all}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="overdue" className="relative">
                <AlertCircle className="h-4 w-4 mr-1" />
                Overdue
                {counts.overdue > 0 && (
                  <Badge variant="destructive" className="ml-2 px-1.5 py-0 text-xs">
                    {counts.overdue}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="today" className="relative">
                <Clock className="h-4 w-4 mr-1" />
                Today
                {counts.today > 0 && (
                  <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">
                    {counts.today}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="relative">
                Upcoming
                {counts.upcoming > 0 && (
                  <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">
                    {counts.upcoming}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed" className="relative">
                <CheckCircle className="h-4 w-4 mr-1" />
                Completed
                {counts.completed > 0 && (
                  <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">
                    {counts.completed}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading activities...</p>
        </div>
      ) : filteredActivities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No activities found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Try adjusting your search' : 'Stay organized by adding your first activity'}
            </p>
            {!searchQuery && (
              <Button asChild>
                <Link to="/dashboard/activities/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Activity
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredActivities.map((activity) => {
            const Icon = getActivityIcon(activity.activity_type);
            const isOverdue = activity.status !== 'completed' && activity.status !== 'cancelled' &&
              activity.due_date && isPast(new Date(activity.due_date)) && !isToday(new Date(activity.due_date));
            
            return (
              <Card 
                key={activity.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/dashboard/activities/${activity.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{activity.subject}</CardTitle>
                          {isOverdue && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Overdue
                            </Badge>
                          )}
                        </div>
                        {activity.description && (
                          <CardDescription className="line-clamp-2">
                            {activity.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      <Badge className={getStatusColor(activity.status)}>
                        {activity.status.replace('_', ' ')}
                      </Badge>
                      <Badge className={getPriorityColor(activity.priority)}>
                        {activity.priority}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {activity.due_date ? (
                          <span>{format(new Date(activity.due_date), 'MMM dd, yyyy HH:mm')}</span>
                        ) : (
                          <span>No due date</span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {activity.activity_type}
                      </Badge>
                    </div>
                    {activity.status !== 'completed' && activity.status !== 'cancelled' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkComplete(activity.id);
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark Complete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}
