import { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { KanbanBoard, ColumnType } from '@/components/kanban/KanbanBoard';
import { KanbanItem } from '@/components/kanban/KanbanCard';
import { OpportunityStage, stages, stageLabels, stageColors } from '@/pages/dashboard/opportunities-data';
import { toast } from 'sonner';

export function OpportunitiesKanbanBoard() {
  const { scopedDb, context } = useCRM();
  const [items, setItems] = useState<KanbanItem[]>([]);
  const [loading, setLoading] = useState(true);

  const columns: ColumnType[] = stages.map(stage => ({
    id: stage,
    title: stageLabels[stage],
    color: stageColors[stage]
  }));

  useEffect(() => {
    const fetchOpps = async () => {
      if (!context?.userId) return;
      setLoading(true);
      
      const { data, error } = await scopedDb
        .from('opportunities')
        .select('id, name, amount, stage')
        .eq('owner_id', context.userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch opportunities:', error);
        toast.error('Failed to load opportunities');
      } else {
        const kanbanItems: KanbanItem[] = (data || []).map((opp: any) => ({
          id: opp.id,
          title: opp.name,
          status: opp.stage,
          value: opp.amount,
          currency: 'USD'
        }));
        setItems(kanbanItems);
      }
      setLoading(false);
    };

    fetchOpps();
  }, [scopedDb, context?.userId]);

  const handleDragEnd = async (activeId: string, overId: string, newStatus: string) => {
    // Optimistic update
    setItems(prev => prev.map(item => 
      item.id === activeId ? { ...item, status: newStatus } : item
    ));

    const { error } = await scopedDb
      .from('opportunities')
      .update({ stage: newStatus })
      .eq('id', activeId);

    if (error) {
      console.error('Failed to update opportunity stage:', error);
      toast.error('Failed to update stage');
      // Revert logic could be added here
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading opportunities...</div>;
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
