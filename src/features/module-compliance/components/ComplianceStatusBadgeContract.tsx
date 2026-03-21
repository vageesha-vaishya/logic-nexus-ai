import { Badge } from '@/components/ui/badge';

type ComplianceStatusBadgeContractProps = {
  status: 'clear' | 'warning' | 'blocked' | 'escalated';
  summary: string;
};

export function ComplianceStatusBadgeContract({ status, summary }: ComplianceStatusBadgeContractProps) {
  const variant = status === 'clear' ? 'secondary' : status === 'warning' ? 'outline' : 'destructive';
  return (
    <div className="flex items-center gap-2" data-compliance-contract="readonly-status-summary">
      <Badge variant={variant}>{status.toUpperCase()}</Badge>
      <p className="text-xs text-muted-foreground">{summary}</p>
    </div>
  );
}
