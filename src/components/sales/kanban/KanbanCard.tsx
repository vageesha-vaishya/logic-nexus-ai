import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Quote } from '@/pages/dashboard/quotes-data';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, MapPin, CheckSquare, Square, DollarSign } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface KanbanCardProps {
  quote: Quote;
  isOverlay?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onClick?: (id: string) => void;
  bulkMode?: boolean;
  showFields?: {
    account: boolean;
    opportunity: boolean;
    value: boolean;
    margin: boolean;
    validUntil: boolean;
  };
}

export function KanbanCard({ quote, isOverlay, isSelected, onSelect, onClick, bulkMode, showFields }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: quote.id,
    data: {
      type: 'Quote',
      quote,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isStale = new Date(quote.created_at).getTime() < Date.now() - 48 * 60 * 60 * 1000;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (bulkMode && onSelect) {
          e.stopPropagation();
          onSelect(quote.id);
        } else if (onClick) {
          onClick(quote.id);
        }
      }}
      className={`
        relative cursor-grab active:cursor-grabbing hover:shadow-md transition-all
        ${isDragging ? 'opacity-50' : ''}
        ${isOverlay ? 'shadow-xl rotate-2 scale-105 cursor-grabbing' : ''}
        ${isStale && !isOverlay ? 'border-l-4 border-l-red-500' : ''}
        ${isSelected ? 'ring-2 ring-primary' : ''}
      `}
    >
      <CardContent className="p-3 space-y-2">
        {bulkMode && (
          <div className="absolute top-2 right-2 z-10">
            {isSelected ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : (
              <Square className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        )}
        
        <div className="flex justify-between items-start">
          <span className="text-xs font-mono text-muted-foreground">{quote.quote_number}</span>
          {(showFields?.value ?? true) && (
            <span className="font-bold text-sm flex items-center">
               <DollarSign className="h-3 w-3 mr-0.5" />
              {new Intl.NumberFormat('en-US', { style: 'decimal', minimumFractionDigits: 0 }).format(quote.sell_price || 0)}
            </span>
          )}
        </div>
        
        {(showFields?.account ?? true) && (
          <h4 className="text-sm font-semibold line-clamp-1" title={quote.accounts?.name || 'Unknown Account'}>
            {quote.accounts?.name || 'Unknown Account'}
          </h4>
        )}

        {(showFields?.opportunity ?? true) && (
          <div className="text-xs text-muted-foreground line-clamp-1">
              {quote.title || 'Untitled Quote'}
          </div>
        )}

        {(showFields?.margin ?? true) && quote.margin_percentage !== null && (
          <div className="flex items-center gap-1 text-xs">
             <span className={quote.margin_percentage >= 30 ? 'text-green-600 font-medium' : quote.margin_percentage < 15 ? 'text-red-600' : 'text-yellow-600'}>
               {quote.margin_percentage}% Margin
             </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          {(showFields?.validUntil ?? true) && quote.valid_until && (
             <div className="flex items-center gap-1 text-[10px] text-muted-foreground" title={`Valid until ${new Date(quote.valid_until).toLocaleDateString()}`}>
               <CalendarClock className="w-3 h-3" />
               {new Date(quote.valid_until).toLocaleDateString()}
             </div>
          )}
          
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto" title={`Created ${new Date(quote.created_at).toLocaleString()}`}>
            {formatDistanceToNow(new Date(quote.created_at), { addSuffix: true })}
          </div>
          
          {isStale && (
            <Badge variant="destructive" className="h-4 px-1 text-[9px] ml-1">Stale</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
