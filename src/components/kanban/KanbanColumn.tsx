import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useEffect, useRef } from "react";
import { KanbanCard, KanbanItem } from "./KanbanCard";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface KanbanColumnProps {
  column: {
    id: string;
    title: string;
    items: KanbanItem[];
    color?: string; // e.g. "bg-blue-500"
  };
  onItemUpdate?: (id: string, updates: Partial<KanbanItem>) => Promise<void>;
  onItemView?: (id: string) => void;
  onItemDelete?: (id: string) => Promise<void> | void;
  onColumnDelete?: (columnId: string, itemIds: string[]) => Promise<void> | void;
  initialScrollTop?: number;
  onScrollTopChange?: (columnId: string, scrollTop: number) => void;
  themeVariant?: "default" | "reference";
}

type TimelineTone = {
  line: string;
  dot: string;
  statusBand: string;
};

interface TimelineLeadEntryProps {
  item: KanbanItem;
  timelineTone: TimelineTone;
  columnId: string;
  themeVariant: "default" | "reference";
  onItemUpdate?: (id: string, updates: Partial<KanbanItem>) => Promise<void>;
  onItemView?: (id: string) => void;
  onItemDelete?: (id: string) => Promise<void> | void;
}

function TimelineLeadEntry({
  item,
  timelineTone,
  columnId,
  themeVariant,
  onItemUpdate,
  onItemView,
  onItemDelete,
}: TimelineLeadEntryProps) {
  return (
    <div
      className={cn("relative", themeVariant === "reference" ? "pl-4 pb-3 last:pb-0" : "")}
      data-testid={`kanban-timeline-entry-${columnId}-${item.id}`}
      data-status-band={timelineTone.statusBand}
    >
      {themeVariant === "reference" && (
        <>
          <span
            className={cn(
              "absolute left-1.5 w-[3px] rounded-full transition-colors duration-300 ease-in-out",
              timelineTone.line,
              "top-1.5 bottom-1.5"
            )}
            data-testid={`kanban-timeline-line-${columnId}-${item.id}`}
            aria-hidden="true"
          />
          <span
            className={cn(
              "absolute left-[3px] top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white transition-colors duration-300 ease-in-out",
              timelineTone.dot
            )}
            data-testid={`kanban-timeline-dot-${columnId}-${item.id}`}
            aria-hidden="true"
          />
        </>
      )}
      <KanbanCard
        item={item}
        onUpdate={onItemUpdate}
        onView={onItemView}
        onDelete={onItemDelete}
        themeVariant={themeVariant}
      />
    </div>
  );
}

export function KanbanColumn({
  column,
  onItemUpdate,
  onItemView,
  onItemDelete,
  onColumnDelete,
  initialScrollTop,
  onScrollTopChange,
  themeVariant = "default",
}: KanbanColumnProps) {
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
  const contentScrollRef = useRef<HTMLDivElement | null>(null);

  const totalValue = column.items.reduce((acc, item) => acc + (item.value || 0), 0);
  const accentColorClass = (() => {
    const normalized = column.id.toLowerCase();
    const statusColors: Record<string, string> = {
      new: "bg-[#3b82f6]",
      contacted: "bg-[#a855f7]",
      qualified: "bg-[#14b8a6]",
      proposal: "bg-[#eab308]",
      proposition: "bg-[#eab308]",
      negotiation: "bg-[#f97316]",
      won: "bg-[#22c55e]",
      lost: "bg-[#ef4444]",
      converted: "bg-[#6366f1]",
    };
    return statusColors[normalized] ?? column.color?.split(' ')[0] ?? "bg-red-500";
  })();

  const getTimelineTone = (item: KanbanItem): TimelineTone => {
    const status = item.status.toLowerCase();
    const statusColors: Record<string, TimelineTone> = {
      new: { line: "bg-[#3b82f6]", dot: "bg-[#3b82f6]", statusBand: "new" },
      contacted: { line: "bg-[#a855f7]", dot: "bg-[#a855f7]", statusBand: "contacted" },
      qualified: { line: "bg-[#14b8a6]", dot: "bg-[#14b8a6]", statusBand: "qualified" },
      proposal: { line: "bg-[#eab308]", dot: "bg-[#eab308]", statusBand: "proposal" },
      negotiation: { line: "bg-[#f97316]", dot: "bg-[#f97316]", statusBand: "negotiation" },
      won: { line: "bg-[#22c55e]", dot: "bg-[#22c55e]", statusBand: "won" },
      lost: { line: "bg-[#ef4444]", dot: "bg-[#ef4444]", statusBand: "lost" },
      converted: { line: "bg-[#6366f1]", dot: "bg-[#6366f1]", statusBand: "converted" },
    };
    return statusColors[status] ?? { line: "bg-[#ef4444]", dot: "bg-[#ef4444]", statusBand: status || "unknown" };
  };

  useEffect(() => {
    const element = contentScrollRef.current;
    if (!element) return;
    if (typeof initialScrollTop === 'number') {
      element.scrollTop = initialScrollTop;
    }
  }, [initialScrollTop]);

  useEffect(() => {
    const element = contentScrollRef.current;
    if (!element) return;
    const onScroll = () => {
      onScrollTopChange?.(column.id, element.scrollTop);
    };
    element.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      element.removeEventListener('scroll', onScroll);
    };
  }, [column.id, onScrollTopChange]);

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`w-[85vw] sm:w-[300px] md:min-w-[300px] md:flex-1 md:max-w-[400px] h-[500px] max-h-[calc(100vh-200px)] opacity-50 flex-shrink-0 snap-center ${themeVariant === "reference" ? "rounded-md bg-white border-2 border-dashed border-[#d8dee8]" : "rounded-xl bg-muted/50 border-2 border-dashed border-primary/20"}`}
      />
    );
  }

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 320, damping: 28, mass: 0.5 }}
      className="w-[85vw] sm:w-[300px] md:min-w-[300px] md:flex-1 md:max-w-[400px] flex flex-col gap-2 h-full max-h-[calc(100vh-180px)] flex-shrink-0 snap-center"
      data-testid={`kanban-column-${column.id}`}
      data-column-id={column.id}
    >
      <div 
        {...attributes} 
        {...listeners}
        className={cn(
          "flex items-center justify-between p-2 cursor-grab active:cursor-grabbing relative group",
          themeVariant === "reference"
            ? "rounded-md bg-white border border-[#e4e8f0] shadow-none pt-2.5"
            : "rounded-lg bg-card border shadow-sm",
          themeVariant === "default" && (column.color ? `border-l-4 ${column.color.replace('bg-', 'border-l-')}` : "border-l-4 border-l-transparent")
        )}
      >
        {themeVariant === "reference" && (
          <div className={cn("absolute inset-x-0 top-0 h-0.5 rounded-t-md", accentColorClass)} />
        )}
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm" data-testid={`kanban-column-title-${column.id}`}>{column.title}</h3>
          <Badge variant="secondary" className={cn("text-xs px-1.5 py-0 h-4", themeVariant === "reference" && "bg-[#f4f7fb] text-[#344054]")}>
            {column.items.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={!onColumnDelete || column.items.length === 0}
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  if (!onColumnDelete) return;
                  void onColumnDelete(column.id, column.items.map((item) => item.id));
                }}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete all
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {totalValue > 0 && (
         <div className={cn("px-2 text-xs font-medium flex justify-between items-center", themeVariant === "reference" ? "text-[#6b7280]" : "text-muted-foreground")}>
            <span>Total Value</span>
            <span className="font-mono">${totalValue.toLocaleString()}</span>
         </div>
      )}

      <div className={cn("flex-1 p-1.5 transition-colors overflow-hidden", themeVariant === "reference" ? "bg-white rounded-md border border-[#edf1f7] hover:border-[#dce3ee]" : "bg-muted/30 rounded-xl border border-transparent hover:border-muted-foreground/10")}>
        <div
          ref={contentScrollRef}
          className="h-full overflow-y-auto overflow-x-hidden pr-2 -mr-2 scroll-smooth [scrollbar-gutter:stable] touch-pan-y"
          data-testid={`kanban-column-scroll-${column.id}`}
          tabIndex={0}
        >
          <SortableContext items={itemsIds}>
            <div className={cn("min-h-[100px] pb-4 pr-2", themeVariant === "reference" ? "flex flex-col" : "flex flex-col gap-2")}>
              <AnimatePresence mode="popLayout" initial={false}>
                {column.items.map((item) => {
                  const timelineTone = getTimelineTone(item);
                  return (
                    <TimelineLeadEntry
                      key={item.id}
                      item={item}
                      timelineTone={timelineTone}
                      columnId={column.id}
                      themeVariant={themeVariant}
                      onItemUpdate={onItemUpdate}
                      onItemView={onItemView}
                      onItemDelete={onItemDelete}
                    />
                  );
                })}
              </AnimatePresence>
            </div>
          </SortableContext>
        </div>
      </div>
    </motion.div>
  );
}
