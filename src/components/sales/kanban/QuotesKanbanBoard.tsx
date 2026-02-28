import { useMemo, useState } from 'react';
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
  
  // Calculate split point for two rows (roughly half)
  const splitIndex = Math.ceil(displayedStages.length / 2);
  const row1Stages = displayedStages.slice(0, splitIndex);
  const row2Stages = displayedStages.slice(splitIndex);

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

  const getGridClass = (count: number) => {
    const map: Record<number, string> = {
      1: 'lg:grid-cols-1',
      2: 'lg:grid-cols-2',
      3: 'lg:grid-cols-3',
      4: 'lg:grid-cols-4',
      5: 'lg:grid-cols-5',
    };
    return map[count] || 'lg:grid-cols-5';
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className={className || "flex flex-col gap-8 h-full"}>
        {/* Row 1 */}
        <div className={`grid grid-cols-1 gap-4 h-[calc(50%-1rem)] ${getGridClass(row1Stages.length)}`}>
          {row1Stages.map((stage) => (
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
            />
          ))}
        </div>

        {/* Row 2 */}
        {row2Stages.length > 0 && (
          <div className={`grid grid-cols-1 gap-4 h-[calc(50%-1rem)] ${getGridClass(row2Stages.length)}`}>
            {row2Stages.map((stage) => (
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
              />
            ))}
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
