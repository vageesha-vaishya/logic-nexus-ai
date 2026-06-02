import { format } from 'date-fns';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  DuplicateLeadBadge,
  SecurityBadge,
  SentimentBadge,
  UrgencyBadge,
  clampText,
} from './badges';
import { lookupDuplicate } from './useEmailInbox';
import type { DuplicateMap, Email, ThreadGroup } from './types';

interface ThreadRowProps {
  thread: ThreadGroup;
  duplicateMap: DuplicateMap;
  onOpen: (email: Email) => void;
}

export function ThreadRow({ thread, duplicateMap, onOpen }: ThreadRowProps) {
  const latest = thread.latestEmail;
  const dup = lookupDuplicate(duplicateMap, latest.from_email);

  return (
    <div
      className={`p-4 hover:bg-accent/5 cursor-pointer transition-colors ${!latest.is_read ? 'bg-primary/5' : ''} overflow-x-hidden`}
      onClick={() => onOpen(latest)}
    >
      <div className="flex items-start gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs h-5 px-1.5 min-w-[1.5rem] flex justify-center">
            {thread.count}
          </Badge>
        </div>
        <div className="flex-1 min-w-0 max-w-[100ch]">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`font-medium ${!latest.is_read ? 'font-bold' : ''} break-words whitespace-normal lg:truncate`}
              >
                {latest.subject || '(No Subject)'}
              </span>
              {dup && dup.count > 0 && <DuplicateLeadBadge />}
              <UrgencyBadge urgency={latest.ai_urgency} />
              <SentimentBadge sentiment={latest.ai_sentiment} />
              <SecurityBadge email={latest} />
            </div>
            <span className="text-xs text-muted-foreground">
              {format(new Date(latest.received_at), 'MMM d, h:mm a')}
            </span>
          </div>
          <div
            className="text-sm text-muted-foreground break-words whitespace-normal"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}
          >
            {clampText(latest.snippet || '', 100)}
          </div>
          <div className="mt-1">
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(latest);
              }}
            >
              Open
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
