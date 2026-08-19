import { ArrowRight } from 'lucide-react';

interface CRMAuditDiffProps {
  changedFields?: string[];
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
}

export function CRMAuditDiff({ changedFields = [], oldValues = {}, newValues = {} }: CRMAuditDiffProps) {
  if (changedFields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mt-3">
      {changedFields.map((field) => (
        <div key={field} className="text-sm grid grid-cols-[1fr,auto,1fr] gap-2 items-center p-2 bg-muted/30 rounded">
          <div className="font-mono text-xs text-muted-foreground truncate">{field}</div>
          <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <div className="flex flex-col gap-1">
            {oldValues[field] !== undefined && (
              <div className="line-through text-xs text-muted-foreground opacity-70 truncate">
                {formatValue(oldValues[field])}
              </div>
            )}
            <div className="font-medium text-green-600 dark:text-green-400 truncate">
              {formatValue(newValues[field])}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatValue(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
