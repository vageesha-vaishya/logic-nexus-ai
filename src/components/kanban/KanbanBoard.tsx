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
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard, KanbanItem } from "./KanbanCard";
import { AnimatePresence, motion } from "framer-motion";

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
  onItemDelete?: (id: string) => Promise<void> | void;
  onColumnDelete?: (columnId: string, itemIds: string[]) => Promise<void> | void;
  className?: string;
  scrollPersistenceKey?: string;
  themeVariant?: "default" | "reference";
}

export function KanbanBoard({
  columns,
  items,
  onDragEnd,
  onItemUpdate,
  onItemClick,
  onItemDelete,
  onColumnDelete,
  className,
  scrollPersistenceKey,
  themeVariant = "default",
}: KanbanBoardProps) {
  const [activeItem, setActiveItem] = useState<KanbanItem | null>(null);
  const [activeColumn, setActiveColumn] = useState<ColumnType | null>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  const [topScrollContentWidth, setTopScrollContentWidth] = useState(0);
  const topHorizontalScrollRef = useRef<HTMLDivElement | null>(null);
  const horizontalScrollRef = useRef<HTMLDivElement | null>(null);
  const verticalScrollByColumnRef = useRef<Record<string, number>>({});
  const isSyncingHorizontalRef = useRef(false);
  
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

  const persistedScrollStorageKey = useMemo(() => {
    if (!scrollPersistenceKey) return null;
    return `kanban-scroll:${scrollPersistenceKey}`;
  }, [scrollPersistenceKey]);

  const updateHorizontalScrollIndicators = useCallback(() => {
    const element = horizontalScrollRef.current;
    if (!element) return;
    const maxLeft = element.scrollWidth - element.clientWidth;
    setShowLeftFade(element.scrollLeft > 0);
    setShowRightFade(element.scrollLeft < maxLeft - 1);
    setTopScrollContentWidth(element.scrollWidth);
  }, []);

  const savePersistedScrollState = useCallback((left: number) => {
    if (!persistedScrollStorageKey) return;
    try {
      localStorage.setItem(
        persistedScrollStorageKey,
        JSON.stringify({
          left,
          tops: verticalScrollByColumnRef.current,
        })
      );
    } catch {
      return;
    }
  }, [persistedScrollStorageKey]);

  useEffect(() => {
    const element = horizontalScrollRef.current;
    if (!element) return;
    if (!persistedScrollStorageKey) {
      updateHorizontalScrollIndicators();
      return;
    }
    try {
      const raw = localStorage.getItem(persistedScrollStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { left?: number; tops?: Record<string, number> };
        if (typeof parsed.left === 'number') {
          element.scrollLeft = parsed.left;
        }
        if (parsed.tops && typeof parsed.tops === 'object') {
          verticalScrollByColumnRef.current = parsed.tops;
        }
      }
    } catch {
      void 0;
    }
    updateHorizontalScrollIndicators();
  }, [persistedScrollStorageKey, columns.length, updateHorizontalScrollIndicators]);

  useEffect(() => {
    const mainElement = horizontalScrollRef.current;
    const topElement = topHorizontalScrollRef.current;
    if (!mainElement || !topElement) return;
    const onMainScroll = () => {
      if (isSyncingHorizontalRef.current) return;
      isSyncingHorizontalRef.current = true;
      topElement.scrollLeft = mainElement.scrollLeft;
      isSyncingHorizontalRef.current = false;
      updateHorizontalScrollIndicators();
      savePersistedScrollState(mainElement.scrollLeft);
    };
    const onTopScroll = () => {
      if (isSyncingHorizontalRef.current) return;
      isSyncingHorizontalRef.current = true;
      mainElement.scrollLeft = topElement.scrollLeft;
      isSyncingHorizontalRef.current = false;
      updateHorizontalScrollIndicators();
      savePersistedScrollState(mainElement.scrollLeft);
    };
    const onResize = () => updateHorizontalScrollIndicators();
    const resizeObserver = new ResizeObserver(() => {
      updateHorizontalScrollIndicators();
    });
    resizeObserver.observe(mainElement);
    topElement.scrollLeft = mainElement.scrollLeft;
    onMainScroll();
    mainElement.addEventListener('scroll', onMainScroll, { passive: true });
    topElement.addEventListener('scroll', onTopScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      mainElement.removeEventListener('scroll', onMainScroll);
      topElement.removeEventListener('scroll', onTopScroll);
      window.removeEventListener('resize', onResize);
      resizeObserver.disconnect();
    };
  }, [savePersistedScrollState, updateHorizontalScrollIndicators, columns.length]);

  const handleColumnScrollTopChange = useCallback((columnId: string, scrollTop: number) => {
    verticalScrollByColumnRef.current = {
      ...verticalScrollByColumnRef.current,
      [columnId]: scrollTop,
    };
    const left = horizontalScrollRef.current?.scrollLeft ?? 0;
    savePersistedScrollState(left);
  }, [savePersistedScrollState]);

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
      className={`h-full min-h-0 ${className ?? ''}`}
      data-testid="kanban-board"
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="relative h-full min-h-0">
          <div
            ref={topHorizontalScrollRef}
            className={`mb-2 h-4 overflow-x-auto overflow-y-hidden rounded-md border [scrollbar-gutter:stable] touch-pan-x ${themeVariant === "reference" ? "border-[#e4e8f0] bg-white" : "border-border/60 bg-background/80"}`}
            data-testid="kanban-top-horizontal-scroll"
            tabIndex={0}
            onWheel={(event) => {
              const el = topHorizontalScrollRef.current;
              if (!el) return;
              if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
                el.scrollLeft += event.deltaY;
                event.preventDefault();
              }
            }}
            onKeyDown={(event) => {
              const el = topHorizontalScrollRef.current;
              if (!el) return;
              const viewportStep = Math.max(160, Math.floor(el.clientWidth * 0.6));
              if (event.key === 'ArrowRight') {
                el.scrollBy({ left: 120, behavior: 'smooth' });
                event.preventDefault();
              } else if (event.key === 'ArrowLeft') {
                el.scrollBy({ left: -120, behavior: 'smooth' });
                event.preventDefault();
              } else if (event.key === 'PageDown') {
                el.scrollBy({ left: viewportStep, behavior: 'smooth' });
                event.preventDefault();
              } else if (event.key === 'PageUp') {
                el.scrollBy({ left: -viewportStep, behavior: 'smooth' });
                event.preventDefault();
              } else if (event.key === 'Home') {
                el.scrollTo({ left: 0, behavior: 'smooth' });
                event.preventDefault();
              } else if (event.key === 'End') {
                el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
                event.preventDefault();
              }
            }}
          >
            <div style={{ width: `${Math.max(topScrollContentWidth, 1)}px` }} className="h-px" aria-hidden="true" />
          </div>
          {showLeftFade && (
            <div
              className={`pointer-events-none absolute bottom-0 left-0 top-5 z-10 w-6 ${themeVariant === "reference" ? "bg-gradient-to-r from-white to-transparent" : "bg-gradient-to-r from-background to-transparent"}`}
              aria-hidden="true"
              data-testid="kanban-scroll-left-indicator"
            />
          )}
          {showRightFade && (
            <div
              className={`pointer-events-none absolute bottom-0 right-0 top-5 z-10 w-6 ${themeVariant === "reference" ? "bg-gradient-to-l from-white to-transparent" : "bg-gradient-to-l from-background to-transparent"}`}
              aria-hidden="true"
              data-testid="kanban-scroll-right-indicator"
            />
          )}
          <div
            ref={horizontalScrollRef}
            className="flex h-full min-h-0 gap-3 overflow-x-auto overflow-y-hidden pb-4 pr-1 [scrollbar-gutter:stable] touch-pan-x"
            data-testid="kanban-horizontal-scroll"
            tabIndex={0}
            onKeyDown={(event) => {
              const el = horizontalScrollRef.current;
              if (!el) return;
              const viewportStep = Math.max(160, Math.floor(el.clientWidth * 0.6));
              if (event.key === 'ArrowRight') {
                el.scrollBy({ left: 120, behavior: 'smooth' });
                event.preventDefault();
              } else if (event.key === 'ArrowLeft') {
                el.scrollBy({ left: -120, behavior: 'smooth' });
                event.preventDefault();
              } else if (event.key === 'PageDown') {
                el.scrollBy({ left: viewportStep, behavior: 'smooth' });
                event.preventDefault();
              } else if (event.key === 'PageUp') {
                el.scrollBy({ left: -viewportStep, behavior: 'smooth' });
                event.preventDefault();
              } else if (event.key === 'Home') {
                el.scrollTo({ left: 0, behavior: 'smooth' });
                event.preventDefault();
              } else if (event.key === 'End') {
                el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
                event.preventDefault();
              }
            }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {columns.map((col) => (
                <KanbanColumn
                  key={col.id}
                  column={{
                    ...col,
                    items: groupedItems[col.id] || []
                  }}
                  onItemUpdate={onItemUpdate}
                  onItemView={onItemClick}
                  onItemDelete={onItemDelete}
                  onColumnDelete={onColumnDelete}
                  initialScrollTop={verticalScrollByColumnRef.current[col.id] ?? 0}
                  onScrollTopChange={handleColumnScrollTopChange}
                  themeVariant={themeVariant}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>

        {createPortal(
          <DragOverlay dropAnimation={dropAnimation}>
            {activeItem && (
              <KanbanCard item={activeItem} isOverlay themeVariant={themeVariant} />
            )}
            {activeColumn && (
               <div className="w-[85vw] sm:w-[300px] h-[500px] bg-muted/50 rounded-xl border-2 border-primary" />
            )}
          </DragOverlay>,
          document.body
        )}
      </DndContext>
    </motion.div>
  );
}
