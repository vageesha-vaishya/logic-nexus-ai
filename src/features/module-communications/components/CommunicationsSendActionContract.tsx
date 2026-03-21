import { Badge } from '@/components/ui/badge';

type CommunicationsSendActionContractProps = {
  enabled: boolean;
  summary: string;
};

export function CommunicationsSendActionContract({ enabled, summary }: CommunicationsSendActionContractProps) {
  return (
    <div className="flex items-center gap-2" data-communications-contract="action-api-only">
      <Badge variant={enabled ? 'secondary' : 'destructive'}>
        {enabled ? 'Action API Accepted' : 'Action API Blocked'}
      </Badge>
      <p className="text-xs text-muted-foreground">{summary}</p>
    </div>
  );
}
