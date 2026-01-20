import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './KanbanCard';
import { Quote } from '@/pages/dashboard/quotes-data';
import { AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface KanbanColumnProps {
  id: string;
  title: string;
  color: string;
  quotes: Quote[];
  wipLimit?: number;
  bulkMode?: boolean;
  selectedQuotes?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onQuoteClick?: (id: string) => void;
  showFields?: {
    account: boolean;
    opportunity: boolean;
    value: boolean;
    margin: boolean;
    validUntil: boolean;
  };
}

export function KanbanColumn({ 
  id, 
  title, 
  color, 
  quotes, 
  wipLimit,
  bulkMode,
  selectedQuotes,
  onToggleSelection,
  onQuoteClick,
  showFields
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: id,
  });

  const isOverLimit = wipLimit && quotes.length > wipLimit;

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col w-full min-w-[200px] rounded-lg h-full max-h-full bg-slate-50/50 dark:bg-slate-900/50 border border-border/50"
    >
      {/* Column Header */}
      <div className="flex flex-col gap-2 p-3 border-b bg-background/50 rounded-t-lg backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-foreground">
              {title}
            </h3>
            <Badge 
              variant="secondary" 
              className={`${color} transition-all duration-200`}
            >
              {quotes.length}
            </Badge>
          </div>
          {wipLimit && (
            <div className="flex items-center gap-1">
              {isOverLimit && <AlertCircle className="h-4 w-4 text-destructive" />}
              <span className={`text-xs ${isOverLimit ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                Max: {wipLimit}
              </span>
            </div>
          )}
        </div>
        
        {/* WIP Progress Bar */}
        {wipLimit && (
          <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${isOverLimit ? 'bg-destructive' : 'bg-primary/50'}`}
              style={{ width: `${Math.min((quotes.length / wipLimit) * 100, 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Cards Container */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
        <SortableContext
          items={quotes.map(q => q.id)}
          strategy={verticalListSortingStrategy}
        >
          {quotes.map((quote) => (
            <KanbanCard 
              key={quote.id} 
              quote={quote}
              bulkMode={bulkMode}
              isSelected={selectedQuotes?.has(quote.id)}
              onSelect={onToggleSelection}
              onClick={onQuoteClick}
              showFields={showFields}
            />
          ))}
        </SortableContext>
        
        {quotes.length === 0 && (
          <div className="h-24 border-2 border-dashed border-muted rounded-lg flex items-center justify-center text-xs text-muted-foreground bg-muted/20">
            Drop items here
          </div>
        )}
      </div>
    </div>
  );
}
