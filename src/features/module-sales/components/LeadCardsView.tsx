import type { MutableRefObject } from 'react';
import { LeadCard } from '@/features/module-sales/components/LeadCard';
import type { Lead } from '@/pages/dashboard/leads-data';

interface LeadCardsViewProps {
  leads: Lead[];
  layout: 'grid' | 'list';
  focusedLeadId?: string;
  matchedLeadIds: string[];
  activeMatchedLeadId: string | null;
  leadCardRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  onLeadClick: (lead: Lead) => void;
  onLeadDoubleClick: (lead: Lead) => void;
  onToggleSelection: (leadId: string) => void;
  onDelete: (leadId: string) => void;
  onEdit: (lead: Lead) => void;
}

export function LeadCardsView({
  leads,
  layout,
  focusedLeadId,
  matchedLeadIds,
  activeMatchedLeadId,
  leadCardRefs,
  onLeadClick,
  onLeadDoubleClick,
  onToggleSelection,
  onDelete,
  onEdit,
}: LeadCardsViewProps) {
  return (
    <div className={layout === 'grid' ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-4' : 'flex flex-col gap-3'}>
      {leads.map((lead) => (
        <LeadCard
          ref={(element) => {
            if (element) {
              leadCardRefs.current.set(lead.id, element);
            } else {
              leadCardRefs.current.delete(lead.id);
            }
          }}
          key={lead.id}
          lead={lead}
          onClick={() => onLeadClick(lead)}
          onDoubleClick={() => onLeadDoubleClick(lead)}
          selected={focusedLeadId === lead.id}
          highlighted={matchedLeadIds.includes(lead.id)}
          activeMatch={activeMatchedLeadId === lead.id}
          onSelect={() => onToggleSelection(lead.id)}
          onDelete={() => onDelete(lead.id)}
          onEdit={() => onEdit(lead)}
        />
      ))}
    </div>
  );
}
