import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  useSensors, 
  useSensor, 
  PointerSensor, 
  DragStartEvent, 
  DragOverEvent, 
  DragEndEvent,
  closestCorners
} from '@dnd-kit/core';
import { createPortal } from 'react-dom';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { Quote, QuoteStatus, statusConfig, stages } from '@/pages/dashboard/quotes-data';

interface QuotesKanbanBoardProps {
  quotes: Quote[];
  onStatusChange: (quoteId: string, newStatus: QuoteStatus) => void;
  wipLimits?: Record<QuoteStatus, number>;
  bulkMode?: boolean;
  selectedQuotes?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onQuoteClick?: (id: string) => void;
  className?: string;
  visibleStages?: QuoteStatus[];
  showFields?: {
    account: boolean;
    opportunity: boolean;
    value: boolean;
    margin: boolean;
    validUntil: boolean;
    status: boolean;
  };
}

export function QuotesKanbanBoard({ 
  quotes, 
  onStatusChange,
  wipLimits,
  bulkMode,
  selectedQuotes,
  onToggleSelection,
  onQuoteClick,
  className,
  visibleStages,
  showFields
}: QuotesKanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [topScrollContentWidth, setTopScrollContentWidth] = useState(0);
  const [columnWidth, setColumnWidth] = useState(320);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScrollRef = useRef(false);

  // Group quotes by status
  const columns = useMemo(() => {
    const groups: Record<QuoteStatus, Quote[]> = {} as Record<QuoteStatus, Quote[]>;
    stages.forEach(stage => groups[stage] = []);
    
    quotes.forEach(quote => {
      const status = quote.status;
      if (groups[status]) {
        groups[status].push(quote);
      } else {
        if (groups['draft']) groups['draft'].push(quote);
      }
    });
    return groups;
  }, [quotes]);

  const displayedStages = visibleStages && visibleStages.length > 0 ? visibleStages : stages;

  const updateScrollIndicators = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const maxLeft = container.scrollWidth - container.clientWidth;
    setCanScrollLeft(container.scrollLeft > 8);
    setCanScrollRight(container.scrollLeft < maxLeft - 8);
    setTopScrollContentWidth(container.scrollWidth);
  }, []);

  const updateColumnWidth = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const viewportWidth = container.clientWidth;
    const visibleColumnCount = Math.max(1, Math.min(displayedStages.length, 4));
    const calculated = Math.round(viewportWidth / visibleColumnCount) - 12;
    const constrained = Math.max(280, Math.min(380, calculated));
    setColumnWidth(constrained);
  }, [displayedStages.length]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(() => {
      updateColumnWidth();
      updateScrollIndicators();
    });
    resizeObserver.observe(container);
    updateColumnWidth();
    updateScrollIndicators();
    return () => resizeObserver.disconnect();
  }, [updateColumnWidth, updateScrollIndicators]);

  useEffect(() => {
    updateColumnWidth();
    updateScrollIndicators();
  }, [quotes, displayedStages, updateColumnWidth, updateScrollIndicators]);

  useEffect(() => {
    const main = scrollContainerRef.current;
    const top = topScrollRef.current;
    if (!main || !top) return;
    const syncTop = () => {
      if (isSyncingScrollRef.current) return;
      isSyncingScrollRef.current = true;
      top.scrollLeft = main.scrollLeft;
      isSyncingScrollRef.current = false;
      updateScrollIndicators();
    };
    const syncMain = () => {
      if (isSyncingScrollRef.current) return;
      isSyncingScrollRef.current = true;
      main.scrollLeft = top.scrollLeft;
      isSyncingScrollRef.current = false;
      updateScrollIndicators();
    };
    main.addEventListener('scroll', syncTop, { passive: true });
    top.addEventListener('scroll', syncMain, { passive: true });
    top.scrollLeft = main.scrollLeft;
    return () => {
      main.removeEventListener('scroll', syncTop);
      top.removeEventListener('scroll', syncMain);
    };
  }, [updateScrollIndicators]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required to start drag
      },
    })
  );

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const onDragOver = (event: DragOverEvent) => {
    // We can implement optimistic sorting here if we want smoother column transitions
    // For now, we rely on onDragEnd for status changes
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the quote
    const quote = quotes.find(q => q.id === activeId);
    if (!quote) return;

    // Determine new status
    let newStatus: QuoteStatus | null = null;

    // If dropped on a column container directly
    if (stages.includes(overId as QuoteStatus)) {
      newStatus = overId as QuoteStatus;
    } else {
      // If dropped on another card, find that card's status
      const overQuote = quotes.find(q => q.id === overId);
      if (overQuote) {
        newStatus = overQuote.status;
      }
    }

    if (newStatus && newStatus !== quote.status) {
      onStatusChange(activeId, newStatus);
    }
  };

  const activeQuote = activeId ? quotes.find(q => q.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className={`relative h-full ${className || ''}`}>
        <div
          ref={topScrollRef}
          className="mb-2 h-4 overflow-x-auto overflow-y-hidden rounded-md border border-[#e4e8f0] bg-white [scrollbar-gutter:stable] touch-pan-x"
          tabIndex={0}
        >
          <div style={{ width: `${Math.max(topScrollContentWidth, 1)}px` }} className="h-px" aria-hidden="true" />
        </div>
        <div
          ref={scrollContainerRef}
          onScroll={updateScrollIndicators}
          className="h-[calc(100%-1.5rem)] overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 [scrollbar-gutter:stable] touch-pan-x"
        >
          <div className="flex gap-3 h-full min-w-max pr-1">
            {displayedStages.map((stage) => (
              <KanbanColumn
                key={stage}
                id={stage}
                title={statusConfig[stage]?.label || stage}
                color={statusConfig[stage]?.color || 'bg-gray-100'}
                quotes={columns[stage]}
                wipLimit={wipLimits?.[stage]}
                bulkMode={bulkMode}
                selectedQuotes={selectedQuotes}
                onToggleSelection={onToggleSelection}
                onQuoteClick={onQuoteClick}
                showFields={showFields}
                columnWidth={columnWidth}
              />
            ))}
          </div>
        </div>
        {canScrollLeft && (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-background to-transparent" />
        )}
        {canScrollRight && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-background to-transparent" />
        )}
        {(canScrollLeft || canScrollRight) && (
          <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-background/90 px-2 py-0.5 text-[11px] text-muted-foreground border">
            {canScrollLeft ? "←" : ""}
            {canScrollLeft && canScrollRight ? " " : ""}
            {canScrollRight ? "→" : ""}
          </div>
        )}
      </div>

      {createPortal(
        <DragOverlay>
          {activeQuote ? (
            <KanbanCard quote={activeQuote} isOverlay showFields={showFields} />
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}
