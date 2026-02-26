import { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { KanbanBoard, ColumnType } from '@/components/kanban/KanbanBoard';
import { KanbanItem } from '@/components/kanban/KanbanCard';
import { ShipmentStatus, stages, statusConfig } from '@/pages/dashboard/shipments-data';
import { toast } from 'sonner';

export function ShipmentsKanbanBoard() {
  const { scopedDb, context } = useCRM();
  const [items, setItems] = useState<KanbanItem[]>([]);
  const [loading, setLoading] = useState(true);

  const columns: ColumnType[] = stages.map(stage => ({
    id: stage,
    title: statusConfig[stage].label,
    color: statusConfig[stage].color
  }));

  useEffect(() => {
    const fetchShipments = async () => {
      // Allow fetching even if context.userId is missing (might be admin view)
      // but usually we want some filtering. For now, rely on scopedDb's tenant filter.
      setLoading(true);
      
      const { data, error } = await scopedDb
        .from('shipments')
        .select('id, shipment_number, shipment_type, status, origin_address, destination_address')
        .order('created_at', { ascending: false })
        .limit(50); // Limit to recent shipments for performance

      if (error) {
        console.error('Failed to fetch shipments:', error);
        toast.error('Failed to load shipments');
      } else {
        const kanbanItems: KanbanItem[] = (data || []).map((shipment: any) => {
            const origin = shipment.origin_address?.city || shipment.origin_address?.country || 'Unknown Origin';
            const dest = shipment.destination_address?.city || shipment.destination_address?.country || 'Unknown Dest';
            
            return {
              id: shipment.id,
              title: shipment.shipment_number,
              subtitle: `${origin} → ${dest}`,
              status: shipment.status,
              tags: [shipment.shipment_type]
            };
        });
        setItems(kanbanItems);
      }
      setLoading(false);
    };

    fetchShipments();
  }, [scopedDb]);

  const handleDragEnd = async (activeId: string, overId: string, newStatus: string) => {
    // Optimistic update
    setItems(prev => prev.map(item => 
      item.id === activeId ? { ...item, status: newStatus } : item
    ));

    const { error } = await scopedDb
      .from('shipments')
      .update({ status: newStatus })
      .eq('id', activeId);

    if (error) {
      console.error('Failed to update shipment status:', error);
      toast.error('Failed to update status');
      // Revert logic could be added here
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading shipments...</div>;
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
