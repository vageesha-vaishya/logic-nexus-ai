// File: src/components/crm/audit/CRMAuditTable.tsx

import { format } from 'date-fns';
import { CRMAuditEventBadge } from './CRMAuditEventBadge';
import { CRMAuditDiff } from './CRMAuditDiff';
import { useState } from 'react';

interface CRMAuditTableProps {
  data: any[];
  loading: boolean;
}

export function CRMAuditTable({ data, loading }: CRMAuditTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return <div className="text-center py-4 text-muted-foreground">Loading...</div>;
  }

  if (data.length === 0) {
    return <div className="text-center py-4 text-muted-foreground">No audit logs found</div>;
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted border-b">
          <tr>
            <th className="text-left p-3 font-medium">Time</th>
            <th className="text-left p-3 font-medium">User</th>
            <th className="text-left p-3 font-medium">Action</th>
            <th className="text-left p-3 font-medium">Entity</th>
            <th className="text-left p-3 font-medium">Changed Fields</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr
              key={entry.id}
              className="border-b hover:bg-muted/50 cursor-pointer"
              onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
            >
              <td className="p-3 text-xs">
                {format(new Date(entry.created_at), 'MMM d, HH:mm:ss')}
              </td>
              <td className="p-3 text-xs">{entry.user_name || entry.user_email}</td>
              <td className="p-3">
                <CRMAuditEventBadge action={entry.action} size="sm" />
              </td>
              <td className="p-3 text-xs font-mono">
                {entry.entity_type}:{entry.entity_id.slice(0, 8)}...
              </td>
              <td className="p-3 text-xs text-muted-foreground">
                {entry.changed_fields?.length || 0} fields
              </td>
            </tr>
          ))}
          {/* Expanded row */}
          {expandedId && (
            <tr className="border-b bg-muted/30">
              <td colSpan={5} className="p-4">
                {data.find((e) => e.id === expandedId) && (
                  <CRMAuditDiff
                    changedFields={data.find((e) => e.id === expandedId).changed_fields || []}
                    oldValues={data.find((e) => e.id === expandedId).old_values || {}}
                    newValues={data.find((e) => e.id === expandedId).new_values || {}}
                  />
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
