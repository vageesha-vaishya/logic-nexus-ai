import { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Calendar, CheckCircle2, Clock, AlertCircle, Building2, User, Mail, Phone, FileText, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface Activity {
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
  leads?: {
    id: string;
    first_name: string;
    last_name: string;
    company: string | null;
    status: string;
  } | null;
  accounts?: {
    id: string;
    name: string;
    account_type: string;
  } | null;
  contacts?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

interface ActivityBoardProps {
  activities: Activity[];
  onStatusChange: (id: string, newStatus: string) => void;
}

const STATUSES = [
  { id: 'planned', label: 'Planned', color: 'bg-blue-100 text-blue-800' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
  { id: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-800' },
];

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'call': return <Phone className="h-4 w-4" />;
    case 'email': return <Mail className="h-4 w-4" />;
    case 'meeting': return <Calendar className="h-4 w-4" />;
    case 'task': return <CheckSquare className="h-4 w-4" />;
    case 'note': return <FileText className="h-4 w-4" />;
    default: return <Clock className="h-4 w-4" />;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high': return 'destructive';
    case 'urgent': return 'destructive';
    case 'medium': return 'default';
    case 'low': return 'secondary';
    default: return 'outline';
  }
};

function DraggableActivityCard({ activity }: { activity: Activity }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: activity.id,
    data: activity,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "mb-3 cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      <ActivityCardContent activity={activity} />
    </div>
  );
}

function ActivityCardContent({ activity }: { activity: Activity }) {
  return (
    <Card className="hover:shadow-md transition-shadow border-l-4" style={{ borderLeftColor: activity.priority === 'urgent' || activity.priority === 'high' ? 'hsl(var(--destructive))' : 'transparent' }}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            {getTypeIcon(activity.activity_type)}
            <span className="capitalize">{activity.activity_type}</span>
          </div>
          <Badge variant={getPriorityColor(activity.priority) as any} className="text-[10px] h-5 px-1.5 uppercase">
            {activity.priority}
          </Badge>
        </div>
        
        <p className="font-semibold text-sm line-clamp-2" title={activity.subject}>
          {activity.subject}
        </p>

        {/* Contextual Relationship Mapping */}
        {(activity.leads || activity.accounts || activity.contacts) && (
          <div className="text-xs text-muted-foreground flex flex-col gap-1 pt-1 border-t mt-2">
            {activity.leads && (
              <div className="flex items-center gap-1.5">
                <User className="h-3 w-3" />
                <span className="font-medium">
                  {activity.leads.first_name} {activity.leads.last_name}
                </span>
                {activity.leads.company && (
                  <span className="text-muted-foreground/80">- {activity.leads.company}</span>
                )}
              </div>
            )}
            {activity.accounts && (
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3 w-3" />
                <span>{activity.accounts.name}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          {activity.due_date && (
            <div className={cn("flex items-center gap-1", new Date(activity.due_date) < new Date() && activity.status !== 'completed' ? "text-destructive font-medium" : "")}>
              <Clock className="h-3 w-3" />
              {format(new Date(activity.due_date), 'MMM d')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DroppableColumn({ id, title, activities }: { id: string, title: string, activities: Activity[] }) {
  const { setNodeRef } = useDroppable({
    id: id,
  });

  return (
    <div className="flex flex-col h-full bg-muted/30 rounded-lg border p-2">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-semibold text-sm">{title}</h3>
        <Badge variant="secondary" className="text-xs">{activities.length}</Badge>
      </div>
      <ScrollArea className="flex-1">
        <div ref={setNodeRef} className="min-h-[150px] p-1">
          {activities.map((activity) => (
            <DraggableActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function ActivityBoard({ activities, onStatusChange }: ActivityBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      // Check if dropped on a column (status)
      const newStatus = over.id as string;
      const activity = activities.find(a => a.id === active.id);
      
      if (activity && activity.status !== newStatus && STATUSES.some(s => s.id === newStatus)) {
        onStatusChange(activity.id, newStatus);
      }
    }
  };

  const activeActivity = activeId ? activities.find(a => a.id === activeId) : null;

  return (
    <DndContext 
      sensors={sensors} 
      onDragStart={handleDragStart} 
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-[calc(100vh-220px)] overflow-hidden">
        {STATUSES.map((status) => (
          <DroppableColumn
            key={status.id}
            id={status.id}
            title={status.label}
            activities={activities.filter(a => a.status === status.id)}
          />
        ))}
      </div>
      
      <DragOverlay>
        {activeActivity ? (
          <div className="w-[var(--card-width)] opacity-90 rotate-3 cursor-grabbing">
             <ActivityCardContent activity={activeActivity} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
