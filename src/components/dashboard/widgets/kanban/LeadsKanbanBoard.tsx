import { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { KanbanBoard, ColumnType } from '@/components/kanban/KanbanBoard';
import { KanbanItem } from '@/components/kanban/KanbanCard';
import { LeadStatus, stages, statusConfig } from '@/pages/dashboard/leads-data';
import { toast } from 'sonner';

export function LeadsKanbanBoard() {
  const { scopedDb, context } = useCRM();
  const [items, setItems] = useState<KanbanItem[]>([]);
  const [loading, setLoading] = useState(true);

  const columns: ColumnType[] = stages.map(stage => ({
    id: stage,
    title: statusConfig[stage].label,
    color: statusConfig[stage].color
  }));

  useEffect(() => {
    const fetchLeads = async () => {
      if (!context?.userId) return;
      setLoading(true);
      
      const { data, error } = await scopedDb
        .from('leads')
        .select('id, first_name, last_name, company, status, estimated_value')
        .eq('owner_id', context.userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch leads:', error);
        toast.error('Failed to load leads');
      } else {
        const kanbanItems: KanbanItem[] = (data || []).map((lead: any) => ({
          id: lead.id,
          title: `${lead.first_name} ${lead.last_name}`,
          subtitle: lead.company,
          status: lead.status,
          value: lead.estimated_value,
          currency: 'USD'
        }));
        setItems(kanbanItems);
      }
      setLoading(false);
    };

    fetchLeads();
  }, [scopedDb, context?.userId]);

  const handleDragEnd = async (activeId: string, overId: string, newStatus: string) => {
    // Optimistic update
    setItems(prev => prev.map(item => 
      item.id === activeId ? { ...item, status: newStatus } : item
    ));

    const { error } = await scopedDb
      .from('leads')
      .update({ status: newStatus })
      .eq('id', activeId);

    if (error) {
      console.error('Failed to update lead status:', error);
      toast.error('Failed to update status');
      // Revert logic could be added here
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading leads...</div>;
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
