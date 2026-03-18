import React from 'react';
import { Quote, statusConfig } from '@/pages/dashboard/quotes-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Building2, Briefcase, CalendarClock, CalendarDays, Copy, DollarSign, Trash2, Truck, User, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface QuoteCardProps {
  quote: Quote & {
    accounts?: { id: string; name: string };
    contacts?: { id: string; first_name: string; last_name: string };
    opportunities?: { id: string; name: string };
    carriers?: { id: string; carrier_name: string };
  };
  selected?: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  onDuplicate?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  highlighted?: boolean;
  activeMatch?: boolean;
  className?: string;
}

export const QuoteCard = React.forwardRef<HTMLDivElement, QuoteCardProps>(function QuoteCard(
  {
    quote,
    selected,
    onSelect,
    onClick,
    onDuplicate,
    onDelete,
    highlighted,
    activeMatch,
    className,
  },
  ref
) {
  const statusMeta = statusConfig[quote.status];
  const quoteNumber = quote.quote_number?.trim() || 'Unnumbered Quote';
  const quoteTitle = quote.title?.trim() || 'Untitled Quote';
  const accountName = quote.accounts?.name?.trim() || 'No Account';
  const contactName = quote.contacts ? `${quote.contacts.first_name || ''} ${quote.contacts.last_name || ''}`.trim() : '';
  const contactDisplay = contactName || 'No Contact';
  const opportunityName = quote.opportunities?.name?.trim() || 'No Opportunity';
  const carrierName = quote.carriers?.carrier_name?.trim() || 'No Carrier';
  const priceLabel = quote.sell_price != null ? `$${quote.sell_price.toLocaleString()}` : '-';

  const formatDateLabel = (value?: string | null) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return format(parsed, 'MMM d, yyyy');
  };

  const updatedLabel = formatDateLabel(quote.updated_at);
  const createdLabel = formatDateLabel(quote.created_at);
  const validUntilLabel = formatDateLabel(quote.valid_until);

  const handleAction = (event: React.MouseEvent, callback?: (e: React.MouseEvent) => void) => {
    event.stopPropagation();
    callback?.(event);
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <Card
      ref={ref}
      tabIndex={0}
      data-quote-id={quote.id}
      role="button"
      aria-label={`${quoteNumber}, ${statusMeta?.label || quote.status}, ${priceLabel}`}
      className={cn(
        'group relative flex min-h-[288px] flex-col overflow-hidden border-muted transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        selected && 'ring-2 ring-primary border-primary',
        highlighted && 'border-primary/40 bg-primary/5',
        activeMatch && 'ring-2 ring-amber-500/80 border-amber-500 bg-amber-500/10',
        className
      )}
      onClick={onClick}
      onKeyDown={handleCardKeyDown}
    >
      <div className="absolute left-3 top-3 z-10">
        <Checkbox
          checked={selected}
          onCheckedChange={onSelect}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select ${quoteNumber}`}
          className={cn(
            'bg-background/90 backdrop-blur-sm transition-opacity',
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        />
      </div>

      <div className="border-b bg-muted/25 p-4">
        <div className="flex items-start justify-between gap-3 pl-8">
          <div className="min-w-0 space-y-1">
            <p className="truncate font-mono text-sm font-semibold" title={quoteNumber}>
              {quoteNumber}
            </p>
            <h3 className="line-clamp-2 text-base font-semibold leading-snug" title={quoteTitle}>
              {quoteTitle}
            </h3>
          </div>
          <Badge className={cn('shrink-0 rounded-sm px-2 py-0.5 text-xs', statusMeta?.color)}>
            {statusMeta?.label || quote.status}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <span className="text-muted-foreground">Total Price</span>
            <div className="inline-flex items-center gap-1 rounded-sm bg-emerald-500/10 px-2 py-1 font-medium text-emerald-700 dark:text-emerald-300">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="truncate">{priceLabel}</span>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground">Last Modified</span>
            <div className="inline-flex items-center gap-1 text-sm">
              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{updatedLabel}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t pt-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{accountName}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{opportunityName}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{contactDisplay}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Truck className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{carrierName}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>Created {createdLabel}</span>
            </span>
            <span>Valid {validUntilLabel}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 border-t bg-muted/10 p-2">
        <Button variant="ghost" size="sm" className="h-8 px-0" onClick={(event) => handleAction(event, onDuplicate)} aria-label={`Duplicate ${quoteNumber}`} title="Duplicate">
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={(event) => handleAction(event, onDelete)}
          aria-label={`Delete ${quoteNumber}`}
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-0" onClick={(event) => handleAction(event, onClick)} aria-label={`Open ${quoteNumber}`} title="Open Quote">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
});
