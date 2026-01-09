import { Lead, statusConfig } from '@/pages/dashboard/leads-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Phone, Mail, Edit, Trash2, Building2, DollarSign, TrendingUp, User } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LeadCardProps {
  lead: Lead;
  selected?: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  onEdit?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  className?: string;
}

export function LeadCard({ 
  lead, 
  selected, 
  onSelect, 
  onClick, 
  onEdit, 
  onDelete,
  className 
}: LeadCardProps) {
  
  const handleAction = (e: React.MouseEvent, action?: (e: React.MouseEvent) => void) => {
    e.stopPropagation();
    action?.(e);
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return 'bg-gray-100 text-gray-600';
    if (score >= 70) return 'bg-green-100 text-green-700';
    if (score >= 40) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <Card 
      className={cn(
        "group relative flex flex-col overflow-hidden transition-all hover:shadow-md border-muted",
        selected && "ring-2 ring-primary border-primary",
        className
      )}
      onClick={onClick}
    >
      {/* Selection Overlay/Checkbox */}
      <div className="absolute top-3 left-3 z-10">
        <Checkbox 
          checked={selected}
          onCheckedChange={() => onSelect?.()}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "transition-opacity bg-background/80 backdrop-blur-sm",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        />
      </div>

      {/* Primary Info - Top 25% */}
      <div className="p-4 border-b bg-muted/30">
        <div className="flex justify-between items-start pl-8"> {/* pl-8 for checkbox space */}
          <div className="space-y-1 min-w-0">
            <h3 className="font-semibold truncate text-base" title={`${lead.first_name} ${lead.last_name}`}>
              {lead.first_name} {lead.last_name}
            </h3>
            <div className="flex items-center text-sm text-muted-foreground gap-1.5">
              <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate" title={lead.company || ''}>
                {lead.company || 'No Company'}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
             {lead.estimated_value ? (
               <Badge variant="outline" className="font-mono bg-background text-green-600 border-green-200">
                 <DollarSign className="h-3 w-3 mr-0.5" />
                 {lead.estimated_value.toLocaleString()}
               </Badge>
             ) : (
               <Badge variant="outline" className="text-muted-foreground bg-background">
                 -
               </Badge>
             )}
          </div>
        </div>
      </div>

      {/* Secondary Info - Middle 50% */}
      <div className="p-4 flex-1 space-y-3">
        {/* Contact Details */}
        <div className="space-y-1.5">
          {lead.email && (
            <div className="flex items-center text-sm text-muted-foreground gap-2">
              <Mail className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.phone && (
            <div className="flex items-center text-sm text-muted-foreground gap-2">
              <Phone className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{lead.phone}</span>
            </div>
          )}
        </div>

        {/* Status & Score Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <span className="text-muted-foreground">Status</span>
            <div>
              <Badge className={cn("rounded-sm font-normal", statusConfig[lead.status]?.color)}>
                {statusConfig[lead.status]?.label || lead.status}
              </Badge>
            </div>
          </div>
          <div className="space-y-1">
             <span className="text-muted-foreground">Lead Score</span>
             <div className="flex items-center gap-1.5">
               <Badge variant="secondary" className={cn("rounded-sm", getScoreColor(lead.lead_score))}>
                 <TrendingUp className="h-3 w-3 mr-1" />
                 {lead.lead_score || 0}
               </Badge>
             </div>
          </div>
        </div>
        
        {/* Source */}
        <div className="pt-1 border-t border-dashed">
           <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
             <span>Source: <span className="font-medium text-foreground">{lead.source}</span></span>
             <span>{new Date(lead.created_at).toLocaleDateString()}</span>
           </div>
        </div>
      </div>

      {/* Action Controls - Bottom 25% */}
      <div className="p-2 border-t bg-muted/10 grid grid-cols-4 gap-1">
         <Button 
           variant="ghost" 
           size="sm" 
           className="h-8 w-full px-0" 
           onClick={(e) => lead.phone ? handleAction(e, () => window.location.href = `tel:${lead.phone}`) : undefined}
           disabled={!lead.phone}
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
           title="Email"
         >
           <Mail className="h-4 w-4 text-muted-foreground" />
         </Button>
         <Button 
           variant="ghost" 
           size="sm" 
           className="h-8 w-full px-0 hover:text-blue-600 hover:bg-blue-50"
           onClick={(e) => onEdit && handleAction(e, onEdit)}
           title="Edit"
         >
           <Edit className="h-4 w-4" />
         </Button>
         <Button 
           variant="ghost" 
           size="sm" 
           className="h-8 w-full px-0 hover:text-destructive hover:bg-destructive/10"
           onClick={(e) => onDelete && handleAction(e, onDelete)}
           title="Delete"
         >
           <Trash2 className="h-4 w-4" />
         </Button>
      </div>
    </Card>
  );
}
