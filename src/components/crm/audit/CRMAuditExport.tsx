// File: src/components/crm/audit/CRMAuditExport.tsx

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface CRMAuditExportProps {
  data: any[];
}

export function CRMAuditExport({ data }: CRMAuditExportProps) {
  const handleExport = () => {
    const csv = [
      ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Changed Fields'].join(','),
      ...data.map((entry) =>
        [
          entry.created_at,
          entry.user_email,
          entry.action,
          entry.entity_type,
          entry.entity_id,
          (entry.changed_fields || []).join(';')
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm-audit-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={data.length === 0}>
      <Download className="h-4 w-4 mr-2" />
      Export CSV
    </Button>
  );
}
