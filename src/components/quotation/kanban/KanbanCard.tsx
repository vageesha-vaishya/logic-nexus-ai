import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Quote, statusConfig } from '@/pages/dashboard/quotes-data';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, MapPin, CheckSquare, Square, DollarSign, Building2, FileText } from 'lucide-react';
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
    status: boolean;
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
  const status = statusConfig[quote.status] || { label: quote.status, color: "bg-gray-100 text-gray-800" };

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
        relative cursor-grab active:cursor-grabbing hover:shadow-md transition-all group
        ${isDragging ? 'opacity-50' : ''}
        ${isOverlay ? 'shadow-xl rotate-2 scale-105 cursor-grabbing' : ''}
        ${isStale && !isOverlay ? 'border-l-4 border-l-red-500' : ''}
        ${isSelected ? 'ring-2 ring-primary' : ''}
      `}
    >
      <CardContent className="p-3 space-y-3">
        {bulkMode && (
          <div className="absolute top-2 right-2 z-10">
            {isSelected ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : (
              <Square className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        )}
        
        {/* Header: Quote Number & Status */}
        <div className="flex justify-between items-start gap-2">
          <span className="text-xs font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
            {quote.quote_number}
          </span>
          {(showFields?.status ?? true) && (
            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-5 whitespace-nowrap ${status.color}`}>
              {status.label}
            </Badge>
          )}
        </div>
        
        {/* Body: Account & Title */}
        <div className="space-y-1">
          {(showFields?.account ?? true) && (
            <div className="flex items-center gap-1.5 group-hover:text-primary transition-colors">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <h4 className="text-sm font-semibold line-clamp-1" title={quote.accounts?.name || 'Unknown Account'}>
                {quote.accounts?.name || 'Unknown Account'}
              </h4>
            </div>
          )}

          {(showFields?.opportunity ?? true) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0" />
              <div className="line-clamp-1" title={quote.title}>
                  {quote.title || 'Untitled Quote'}
              </div>
            </div>
          )}
        </div>

        {/* Metrics Row */}
        <div className="flex items-center gap-3 pt-1 border-t border-border/50 mt-2">
          {(showFields?.value ?? true) && (
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Value</span>
              <span className="font-bold text-sm flex items-center text-foreground">
                 <DollarSign className="h-3 w-3 mr-0.5" />
                {new Intl.NumberFormat('en-US', { style: 'decimal', minimumFractionDigits: 0 }).format(quote.sell_price || 0)}
              </span>
            </div>
          )}

          {(showFields?.margin ?? true) && quote.margin_percentage !== null && (
            <div className="flex flex-col ml-auto text-right">
               <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Margin</span>
               <span className={`text-xs font-medium ${
                 quote.margin_percentage >= 30 ? 'text-green-600 dark:text-green-400' : 
                 quote.margin_percentage < 15 ? 'text-red-600 dark:text-red-400' : 
                 'text-yellow-600 dark:text-yellow-400'
               }`}>
                 {quote.margin_percentage}%
               </span>
            </div>
          )}
        </div>

        {/* Footer: Dates & Stale */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
          {(showFields?.validUntil ?? true) && quote.valid_until && (
             <div className="flex items-center gap-1" title={`Valid until ${new Date(quote.valid_until).toLocaleDateString()}`}>
               <CalendarClock className="w-3 h-3" />
               {new Date(quote.valid_until).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
             </div>
          )}
          
          <div className="ml-auto flex items-center gap-2">
            <span title={`Created ${new Date(quote.created_at).toLocaleString()}`}>
              {formatDistanceToNow(new Date(quote.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
