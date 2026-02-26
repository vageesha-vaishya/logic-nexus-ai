import { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { KanbanBoard, ColumnType } from '@/components/kanban/KanbanBoard';
import { KanbanItem } from '@/components/kanban/KanbanCard';
import { QuoteStatus, stages, statusConfig } from '@/pages/dashboard/quotes-data';
import { toast } from 'sonner';

export function QuotesKanbanBoard() {
  const { scopedDb, context } = useCRM();
  const [items, setItems] = useState<KanbanItem[]>([]);
  const [loading, setLoading] = useState(true);

  const columns: ColumnType[] = stages.map(stage => ({
    id: stage,
    title: statusConfig[stage].label,
    color: statusConfig[stage].color
  }));

  useEffect(() => {
    const fetchQuotes = async () => {
      if (!context?.userId) return;
      setLoading(true);
      
      const { data, error } = await scopedDb
        .from('quotes')
        .select('id, quote_number, title, sell_price:total, status')
        //.eq('owner_id', context.userId) // Quotes don't have owner_id directly
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch quotes:', error);
        // Fallback to fetching without owner_id if column doesn't exist or filtering differently
        // But for now, let's assume filtering by tenant/franchise via scopedDb is enough if owner_id is missing
        // Wait, scopedDb handles tenant/franchise automatically.
        // Let's check if quotes has owner_id.
        toast.error('Failed to load quotes');
      } else {
        const kanbanItems: KanbanItem[] = (data || []).map((quote: any) => ({
          id: quote.id,
          title: quote.title || quote.quote_number,
          subtitle: quote.quote_number,
          status: quote.status,
          value: quote.sell_price,
          currency: 'USD'
        }));
        setItems(kanbanItems);
      }
      setLoading(false);
    };

    fetchQuotes();
  }, [scopedDb, context?.userId]);

  const handleDragEnd = async (activeId: string, overId: string, newStatus: string) => {
    // Optimistic update
    setItems(prev => prev.map(item => 
      item.id === activeId ? { ...item, status: newStatus } : item
    ));

    const { error } = await scopedDb
      .from('quotes')
      .update({ status: newStatus })
      .eq('id', activeId);

    if (error) {
      console.error('Failed to update quote status:', error);
      toast.error('Failed to update status');
      // Revert logic could be added here
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading quotes...</div>;
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
