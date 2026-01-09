import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle, 
  Plus, 
  Calendar,
  User,
  Link as LinkIcon
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast, isSameDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface Task {
  id: string;
  title: string;
  due_date: string;
  status: 'pending' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high';
  assigned_to: { name: string; avatar?: string };
  related_to?: { type: 'lead' | 'opportunity'; id: string; name: string };
}

interface TaskSchedulerProps {
  tasks: Task[];
  onAddTask?: () => void;
  onCompleteTask?: (taskId: string) => void;
  className?: string;
}

const getPriorityColor = (priority: Task['priority']) => {
  switch (priority) {
    case 'high': return 'text-red-600 bg-red-50 border-red-200';
    case 'medium': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
    default: return 'text-slate-600 bg-slate-50 border-slate-200';
  }
};

const TaskItem = ({ task, onComplete }: { task: Task; onComplete?: (id: string) => void }) => (
  <div className="flex items-start gap-3 p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow group">
    <button 
      onClick={() => onComplete?.(task.id)}
      aria-label={task.status === 'completed' ? "Mark as incomplete" : "Mark as complete"}
      className={cn(
        "mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
        task.status === 'completed' 
          ? "bg-green-500 border-green-500 text-white" 
          : "border-slate-300 hover:border-green-500 text-transparent hover:text-green-500"
      )}
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
    </button>

    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <span className={cn("font-medium text-sm", task.status === 'completed' && "line-through text-muted-foreground")}>
          {task.title}
        </span>
        <Badge variant="outline" className={cn("text-[10px] uppercase h-5", getPriorityColor(task.priority))}>
          {task.priority}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
        <div className={cn("flex items-center gap-1", 
          task.status !== 'completed' && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && "text-red-600 font-medium"
        )}>
          <Calendar className="h-3.5 w-3.5" />
          {isToday(new Date(task.due_date)) ? 'Today' : 
           isTomorrow(new Date(task.due_date)) ? 'Tomorrow' : 
           format(new Date(task.due_date), 'MMM d, h:mm a')}
        </div>

        {task.assigned_to && (
          <div className="flex items-center gap-1">
            <Avatar className="h-4 w-4">
              <AvatarImage src={task.assigned_to.avatar} />
              <AvatarFallback className="text-[8px]">{task.assigned_to.name[0]}</AvatarFallback>
            </Avatar>
            <span>{task.assigned_to.name}</span>
          </div>
        )}

        {task.related_to && (
          <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
            <LinkIcon className="h-3 w-3" />
            <span className="truncate max-w-[120px]">{task.related_to.name}</span>
          </div>
        )}
      </div>
    </div>
  </div>
);

export function TaskScheduler({ tasks: initialTasks, onAddTask, onCompleteTask, className }: TaskSchedulerProps) {
  const [activeTab, setActiveTab] = useState('upcoming');
  
  const upcomingTasks = initialTasks.filter(t => t.status !== 'completed' && !isPast(new Date(t.due_date)));
  const overdueTasks = initialTasks.filter(t => t.status === 'overdue' || (t.status !== 'completed' && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))));
  const completedTasks = initialTasks.filter(t => t.status === 'completed');

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Tasks
        </CardTitle>
        <Button size="sm" onClick={onAddTask}>
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </CardHeader>
      
      <div className="px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upcoming">
              Upcoming
              <Badge variant="secondary" className="ml-2 bg-slate-200 text-slate-700">{upcomingTasks.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="overdue">
              Overdue
              {overdueTasks.length > 0 && (
                <Badge variant="destructive" className="ml-2">{overdueTasks.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <CardContent className="flex-1 pt-4 min-h-0">
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {activeTab === 'upcoming' && (
              upcomingTasks.length > 0 ? (
                upcomingTasks.map(task => <TaskItem key={task.id} task={task} onComplete={onCompleteTask} />)
              ) : <div className="text-center py-8 text-muted-foreground">No upcoming tasks</div>
            )}
            
            {activeTab === 'overdue' && (
              overdueTasks.length > 0 ? (
                overdueTasks.map(task => <TaskItem key={task.id} task={task} onComplete={onCompleteTask} />)
              ) : <div className="text-center py-8 text-muted-foreground">No overdue tasks</div>
            )}
            
            {activeTab === 'completed' && (
              completedTasks.length > 0 ? (
                completedTasks.map(task => <TaskItem key={task.id} task={task} />)
              ) : <div className="text-center py-8 text-muted-foreground">No completed tasks</div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
