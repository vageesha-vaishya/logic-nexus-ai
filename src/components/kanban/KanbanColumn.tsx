import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo } from "react";
import { KanbanCard, KanbanItem } from "./KanbanCard";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatePresence } from "framer-motion";

interface KanbanColumnProps {
  column: {
    id: string;
    title: string;
    items: KanbanItem[];
    color?: string; // e.g. "bg-blue-500"
  };
  onItemUpdate?: (id: string, updates: Partial<KanbanItem>) => Promise<void>;
  onItemView?: (id: string) => void;
}

export function KanbanColumn({ column, onItemUpdate, onItemView }: KanbanColumnProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: {
      type: "Column",
      column,
    },
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  const itemsIds = useMemo(() => column.items.map((i) => i.id), [column.items]);

  const totalValue = column.items.reduce((acc, item) => acc + (item.value || 0), 0);

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="w-[85vw] sm:w-[300px] md:min-w-[300px] md:flex-1 md:max-w-[400px] h-[500px] max-h-[calc(100vh-200px)] rounded-xl bg-muted/50 border-2 border-dashed border-primary/20 opacity-50 flex-shrink-0 snap-center"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-[85vw] sm:w-[300px] md:min-w-[300px] md:flex-1 md:max-w-[400px] flex flex-col gap-2 h-full max-h-[calc(100vh-180px)] flex-shrink-0 snap-center"
    >
      {/* Column Header */}
      <div 
        {...attributes} 
        {...listeners}
        className={cn(
          "flex items-center justify-between p-2 rounded-lg bg-card border shadow-sm cursor-grab active:cursor-grabbing relative group",
          column.color ? `border-l-4 ${column.color.replace('bg-', 'border-l-')}` : "border-l-4 border-l-transparent"
        )}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{column.title}</h3>
          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
            {column.items.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      {totalValue > 0 && (
         <div className="px-2 text-xs font-medium text-muted-foreground flex justify-between items-center">
            <span>Total Value</span>
            <span className="font-mono">${totalValue.toLocaleString()}</span>
         </div>
      )}

      {/* Sortable Area */}
      <div className="flex-1 bg-muted/30 rounded-xl p-1.5 border border-transparent hover:border-muted-foreground/10 transition-colors overflow-hidden">
        <ScrollArea className="h-full pr-2 -mr-2">
          <SortableContext items={itemsIds}>
            <div className="flex flex-col gap-2 min-h-[100px] pb-4 pr-2">
              <AnimatePresence mode="popLayout" initial={false}>
                {column.items.map((item) => (
                  <KanbanCard 
                    key={item.id} 
                    item={item} 
                    onUpdate={onItemUpdate}
                    onView={onItemView}
                  />
                ))}
              </AnimatePresence>
            </div>
          </SortableContext>
        </ScrollArea>
      </div>
    </div>
  );
}
