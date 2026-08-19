import { useState } from 'react';
import { useCRMAuditTrail } from '@/hooks/useCRMAuditTrail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CRMAuditEventBadge } from './CRMAuditEventBadge';
import { CRMAuditDiff } from './CRMAuditDiff';
import { format } from 'date-fns';
import { History, ChevronDown } from 'lucide-react';

interface CRMAuditHistoryPanelProps {
  entityType: 'lead' | 'contact' | 'opportunity' | 'quote';
  entityId: string;
  tenantId: string;
  maxItems?: number;
}

export function CRMAuditHistoryPanel({
  entityType,
  entityId,
  tenantId,
  maxItems = 10
}: CRMAuditHistoryPanelProps) {
  const { data, loading } = useCRMAuditTrail({
    entityType,
    entityId,
    limit: maxItems
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Activity History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96 pr-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading history...</div>
          ) : data.length === 0 ? (
            <div className="text-sm text-muted-foreground">No activity yet</div>
          ) : (
            <div className="space-y-3">
              {data.slice(0, maxItems).map((entry) => (
                <div
                  key={entry.id}
                  className="border-l-2 border-muted pl-3 pb-3 cursor-pointer hover:border-primary transition-colors"
                  onClick={() =>
                    setExpandedId(expandedId === entry.id ? null : entry.id)
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <CRMAuditEventBadge action={entry.action} size="sm" />
                      <div className="text-xs text-muted-foreground truncate">
                        {entry.user_name || entry.user_email}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(entry.created_at), 'MMM d, HH:mm')}
                    </div>
                    {entry.changed_fields && entry.changed_fields.length > 0 && (
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          expandedId === entry.id ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                  </div>

                  {expandedId === entry.id && (
                    <CRMAuditDiff
                      changedFields={entry.changed_fields || []}
                      oldValues={entry.old_values || {}}
                      newValues={entry.new_values || {}}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
