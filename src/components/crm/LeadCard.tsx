import React from 'react';
import { Lead, statusConfig } from '@/pages/dashboard/leads-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Phone, Mail, Edit, Trash2, Building2, DollarSign, TrendingUp, CalendarDays } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface LeadCardProps {
  lead: Lead;
  selected?: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onEdit?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  highlighted?: boolean;
  activeMatch?: boolean;
  className?: string;
}

export const LeadCard = React.forwardRef<HTMLDivElement, LeadCardProps>(function LeadCard({
  lead,
  selected,
  onSelect,
  onClick,
  onDoubleClick,
  onEdit,
  onDelete,
  highlighted,
  activeMatch,
  className
}, ref) {
  const handleAction = (e: React.MouseEvent, action?: (e: React.MouseEvent) => void) => {
    e.stopPropagation();
    action?.(e);
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return 'bg-muted text-muted-foreground';
    if (score >= 70) return 'bg-green-100 text-green-700';
    if (score >= 40) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unnamed Lead';
  const companyName = lead.company?.trim() || 'No Company';
  const email = lead.email?.trim() || 'No Email';
  const phone = lead.phone?.trim() || 'No Phone';
  const source = lead.source?.trim() || 'Unknown';
  const createdOn = lead.created_at ? new Date(lead.created_at) : null;
  const createdLabel = createdOn && !Number.isNaN(createdOn.getTime()) ? createdOn.toLocaleDateString() : '-';
  const estimatedValueLabel = lead.estimated_value != null ? lead.estimated_value.toLocaleString() : '-';
  const statusLabel = statusConfig[lead.status]?.label || lead.status;
  const scoreValue = lead.lead_score ?? 0;

  return (
    <Card 
      ref={ref}
      tabIndex={0}
      data-lead-id={lead.id}
      role="button"
      aria-label={`${fullName}, ${statusLabel}, score ${scoreValue}`}
      className={cn(
        "group relative flex min-h-[300px] flex-col overflow-hidden border-muted transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        selected && "ring-2 ring-primary border-primary",
        highlighted && "border-primary/40 bg-primary/5",
        activeMatch && "ring-2 ring-amber-500/80 border-amber-500 bg-amber-500/10",
        className
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={handleCardKeyDown}
    >
      <div className="absolute top-3 left-3 z-10">
        <Checkbox 
          checked={selected}
          onCheckedChange={() => onSelect?.()}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${fullName}`}
          className={cn(
            "transition-opacity bg-background/80 backdrop-blur-sm",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        />
      </div>

      <div className="border-b bg-muted/25 p-4">
        <div className="flex items-start justify-between gap-3 pl-8">
          <div className="space-y-1 min-w-0">
            <h3 className="truncate text-base font-semibold leading-tight" title={fullName}>
              {fullName}
            </h3>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              <span className="truncate" title={companyName}>
                {companyName}
              </span>
            </div>
          </div>
          <Badge variant="outline" className="font-mono bg-background text-green-600 border-green-200">
            <DollarSign className="h-3 w-3 mr-0.5" aria-hidden="true" />
            {estimatedValueLabel}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{phone}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <span className="text-muted-foreground">Status</span>
            <div>
              <Badge className={cn("rounded-sm font-normal", statusConfig[lead.status]?.color)}>
                {statusLabel}
              </Badge>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground">Lead Score</span>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className={cn("rounded-sm", getScoreColor(lead.lead_score))}>
                <TrendingUp className="h-3 w-3 mr-1" aria-hidden="true" />
                {scoreValue}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-auto border-t border-dashed pt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Source: <span className="font-medium text-foreground">{source}</span></span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" aria-hidden="true" />
              {createdLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="p-2 border-t bg-muted/10 grid grid-cols-4 gap-1">
         <Button 
           variant="ghost" 
           size="sm" 
           className="h-8 w-full px-0" 
           onClick={(e) => lead.phone ? handleAction(e, () => window.location.href = `tel:${lead.phone}`) : undefined}
           disabled={!lead.phone}
           aria-label={`Call ${fullName}`}
           title="Call"
         >
           <Phone className="h-4 w-4 text-muted-foreground" />
         </Button>
         <Button 
           variant="ghost" 
           size="sm" 
           className="h-8 w-full px-0"
           onClick={(e) => lead.email ? handleAction(e, () => window.location.href = `mailto:${lead.email}`) : undefined}
           disabled={!lead.email}
           aria-label={`Email ${fullName}`}
           title="Email"
         >
           <Mail className="h-4 w-4 text-muted-foreground" />
         </Button>
         <Button 
           variant="ghost" 
           size="sm" 
           className="h-8 w-full px-0 hover:text-blue-600 hover:bg-blue-50"
           onClick={(e) => onEdit && handleAction(e, onEdit)}
           aria-label={`Edit ${fullName}`}
           title="Edit"
         >
           <Edit className="h-4 w-4" />
         </Button>
         <Button 
           variant="ghost" 
           size="sm" 
           className="h-8 w-full px-0 hover:text-destructive hover:bg-destructive/10"
           onClick={(e) => onDelete && handleAction(e, onDelete)}
           aria-label={`Delete ${fullName}`}
           title="Delete"
         >
           <Trash2 className="h-4 w-4" />
         </Button>
      </div>
    </Card>
  );
});
