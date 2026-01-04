import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  closestCorners,
  defaultDropAnimationSideEffects,
  DropAnimation,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard, KanbanItem } from "./KanbanCard";
import { motion } from "framer-motion";

export type ColumnType = {
  id: string;
  title: string;
  color?: string; // Tailwind class like 'bg-blue-500'
};

interface KanbanBoardProps {
  columns: ColumnType[];
  items: KanbanItem[]; // Flat list of items with a 'status' field matching column.id
  onDragEnd: (activeId: string, overId: string, newStatus: string) => void;
  onItemUpdate?: (id: string, updates: Partial<KanbanItem>) => Promise<void>;
  onItemClick?: (id: string) => void;
  className?: string;
}

export function KanbanBoard({ columns, items, onDragEnd, onItemUpdate, onItemClick, className }: KanbanBoardProps) {
  const [activeItem, setActiveItem] = useState<KanbanItem | null>(null);
  const [activeColumn, setActiveColumn] = useState<ColumnType | null>(null);
  
  // Group items by column
  const [groupedItems, setGroupedItems] = useState<Record<string, KanbanItem[]>>({});

  useEffect(() => {
    const grouped: Record<string, KanbanItem[]> = {};
    columns.forEach(col => grouped[col.id] = []);
    items.forEach(item => {
      if (grouped[item.status]) {
        grouped[item.status].push(item);
      }
    });
    setGroupedItems(grouped);
  }, [items, columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Prevent accidental drags
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === "Item") {
      setActiveItem(event.active.data.current.item);
    }
    if (event.active.data.current?.type === "Column") {
      setActiveColumn(event.active.data.current.column);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveItem = active.data.current?.type === "Item";
    const isOverItem = over.data.current?.type === "Item";
    const isOverColumn = over.data.current?.type === "Column";

    if (!isActiveItem) return;

    // Implements "Optimistic Sort" during drag
    if (isActiveItem && isOverItem) {
       const activeItemData = active.data.current?.item as KanbanItem;
       const overItemData = over.data.current?.item as KanbanItem;

       if (activeItemData && overItemData && activeItemData.status !== overItemData.status) {
         // Find source and dest columns
         const sourceColumnId = activeItemData.status;
         const destColumnId = overItemData.status;

         setGroupedItems((prev) => {
            const sourceItems = [...(prev[sourceColumnId] || [])];
            const destItems = [...(prev[destColumnId] || [])];
            
            // Remove from source
            const activeIndex = sourceItems.findIndex(i => i.id === activeId);
            if (activeIndex === -1) return prev; // Not found (maybe already moved)
            
            const [movedItem] = sourceItems.splice(activeIndex, 1);
            movedItem.status = destColumnId; // Update internal status

            // Add to dest (at the position of overItem)
            const overIndex = destItems.findIndex(i => i.id === overId);
            
            let newDestItems;
            if (overIndex >= 0) {
                // Insert before or after based on direction? 
                // Simplification: Insert at overIndex
                destItems.splice(overIndex, 0, movedItem);
                newDestItems = destItems;
            } else {
                newDestItems = [...destItems, movedItem];
            }

            return {
              ...prev,
              [sourceColumnId]: sourceItems,
              [destColumnId]: newDestItems
            };
         });
       }
    }
    
    if (isActiveItem && isOverColumn) {
        const activeItemData = active.data.current?.item as KanbanItem;
        const overColumnId = over.id as string;
        
        if (activeItemData && activeItemData.status !== overColumnId) {
             setGroupedItems((prev) => {
                const sourceColumnId = activeItemData.status;
                const sourceItems = [...(prev[sourceColumnId] || [])];
                const destItems = [...(prev[overColumnId] || [])];
                
                const activeIndex = sourceItems.findIndex(i => i.id === activeId);
                if (activeIndex === -1) return prev;
                
                const [movedItem] = sourceItems.splice(activeIndex, 1);
                movedItem.status = overColumnId;
                
                destItems.push(movedItem);
                
                return {
                    ...prev,
                    [sourceColumnId]: sourceItems,
                    [overColumnId]: destItems
                };
             });
        }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);
    setActiveColumn(null);

    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type === "Item") {
        // Dropped on another item
        if (overData?.type === "Item") {
           const overItem = overData.item as KanbanItem;
           // If status changed, use overItem status. 
           // If same status, it's a reorder (not fully implemented in this stub, but passed to parent)
           onDragEnd(activeId, overId, overItem.status);
        } 
        // Dropped on a column
        else if (overData?.type === "Column") {
           const overColumn = overData.column as ColumnType;
           onDragEnd(activeId, overId, overColumn.id);
        }
    }
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.5",
        },
      },
    }),
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      transition={{ duration: 0.5 }}
      className="h-full"
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex h-full gap-4 pb-4 overflow-x-auto snap-x snap-mandatory">
           {columns.map((col) => (
             <KanbanColumn
               key={col.id}
               column={{
                 ...col,
                 items: groupedItems[col.id] || []
               }}
               onItemUpdate={onItemUpdate}
               onItemView={onItemClick}
             />
           ))}
        </div>

        {createPortal(
          <DragOverlay dropAnimation={dropAnimation}>
            {activeItem && (
              <KanbanCard item={activeItem} isOverlay />
            )}
            {activeColumn && (
               <div className="w-[300px] h-[500px] bg-muted/50 rounded-xl border-2 border-primary" />
            )}
          </DragOverlay>,
          document.body
        )}
      </DndContext>
    </motion.div>
  );
}
