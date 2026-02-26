import { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { KanbanBoard, ColumnType } from '@/components/kanban/KanbanBoard';
import { KanbanItem } from '@/components/kanban/KanbanCard';
import { toast } from 'sonner';

// Define status config for activities since it might not be exported
const activityStages = ['planned', 'in_progress', 'completed', 'cancelled'];
const activityStatusConfig: Record<string, { label: string; color: string }> = {
  planned: { label: 'Planned', color: 'bg-blue-500/10 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-purple-500/10 text-purple-700' },
  completed: { label: 'Completed', color: 'bg-green-500/10 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/10 text-red-700' },
};

export function ActivitiesKanbanBoard() {
  const { scopedDb, context } = useCRM();
  const [items, setItems] = useState<KanbanItem[]>([]);
  const [loading, setLoading] = useState(true);

  const columns: ColumnType[] = activityStages.map(stage => ({
    id: stage,
    title: activityStatusConfig[stage].label,
    color: activityStatusConfig[stage].color
  }));

  useEffect(() => {
    const fetchActivities = async () => {
      if (!context?.userId) return;
      setLoading(true);
      
      const { data, error } = await scopedDb
        .from('activities')
        .select('id, subject, activity_type, status, due_date')
        .eq('assigned_to', context.userId)
        .order('due_date', { ascending: true })
        .limit(50);

      if (error) {
        console.error('Failed to fetch activities:', error);
        toast.error('Failed to load activities');
      } else {
        const kanbanItems: KanbanItem[] = (data || []).map((activity: any) => ({
          id: activity.id,
          title: activity.subject || 'Untitled Activity',
          subtitle: activity.due_date ? new Date(activity.due_date).toLocaleDateString() : 'No Due Date',
          status: activity.status || 'planned',
          tags: [activity.activity_type]
        }));
        setItems(kanbanItems);
      }
      setLoading(false);
    };

    fetchActivities();
  }, [scopedDb, context?.userId]);

  const handleDragEnd = async (activeId: string, overId: string, newStatus: string) => {
    // Optimistic update
    setItems(prev => prev.map(item => 
      item.id === activeId ? { ...item, status: newStatus } : item
    ));

    const { error } = await scopedDb
      .from('activities')
      .update({ status: newStatus })
      .eq('id', activeId);

    if (error) {
      console.error('Failed to update activity status:', error);
      toast.error('Failed to update status');
      // Revert logic could be added here
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading activities...</div>;
  }

  return (
    <div className="h-full min-h-[400px]">
      <KanbanBoard 
        columns={columns} 
        items={items} 
        onDragEnd={handleDragEnd}
        className="h-full"
      />
    </div>
  );
}
