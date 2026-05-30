import { format } from 'date-fns';
import { Archive, Flag, Paperclip, Shield, Star, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import {
  DuplicateLeadBadge,
  SecurityBadge,
  SentimentBadge,
  UrgencyBadge,
  clampText,
  getPriorityColorClass,
} from './badges';
import { lookupDuplicate } from './useEmailInbox';
import type { DuplicateMap, Email } from './types';

interface EmailRowProps {
  email: Email;
  duplicateMap: DuplicateMap;
  onOpen: (email: Email) => void;
  onToggleStar: (id: string, isStarred: boolean) => void;
  onUpdatePriority: (id: string, priority: string) => void;
  onProcess: (id: string) => void;
  onScan: (id: string) => void;
  onMoveToFolder: (id: string, folder: string) => void;
}

export function EmailRow(props: EmailRowProps) {
  const { email, duplicateMap, onOpen, onToggleStar, onUpdatePriority, onProcess, onScan, onMoveToFolder } = props;
  const dup = lookupDuplicate(duplicateMap, email.from_email);

  return (
    <div
      className={`p-4 hover:bg-accent/5 cursor-pointer transition-colors ${!email.is_read ? 'bg-primary/5' : ''} overflow-x-hidden`}
      onClick={() => onOpen(email)}
    >
      <div className="flex items-start gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar(email.id, email.is_starred);
            }}
            className="text-muted-foreground hover:text-warning transition-colors"
          >
            <Star className={`w-4 h-4 ${email.is_starred ? 'fill-warning text-warning' : ''}`} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className={`transition-colors ${getPriorityColorClass(email.priority)}`}
                aria-label="Set priority"
                title="Set priority"
              >
                <Flag className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Priority</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={(email.priority || 'normal').toLowerCase()}
                onValueChange={(v) => onUpdatePriority(email.id, v)}
              >
                <DropdownMenuRadioItem value="red">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Red
                  </span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="yellow">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    Yellow
                  </span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="green">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Green
                  </span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="brown">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-700" />
                    Brown
                  </span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="normal">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                    Normal
                  </span>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex-1 min-w-0 max-w-[100ch]">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`font-medium ${!email.is_read ? 'font-bold' : ''} break-words whitespace-normal lg:truncate`}
              >
                {email.from_name || email.from_email}
              </span>
              {dup && dup.count > 0 && <DuplicateLeadBadge />}
              {email.has_attachments && <Paperclip className="w-4 h-4 text-muted-foreground" />}
              <UrgencyBadge urgency={email.ai_urgency} />
              <SentimentBadge sentiment={email.ai_sentiment} />
              <SecurityBadge email={email} />
            </div>
            <span className="text-xs text-muted-foreground">
              {format(new Date(email.received_at), 'MMM d, h:mm a')}
            </span>
          </div>
          <div
            className={`text-sm mb-1 ${!email.is_read ? 'font-semibold' : ''} break-words whitespace-normal lg:truncate`}
          >
            {clampText(email.subject || '', 100)}
          </div>
          <div
            className="text-sm text-muted-foreground break-words whitespace-normal"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}
          >
            {clampText(email.snippet || '', 100)}
          </div>
          <div className="mt-1">
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(email);
              }}
            >
              Open
            </Button>
          </div>
          {email.labels && email.labels.length > 0 && (
            <div className="flex gap-1 mt-2">
              {email.labels.map((label: string, idx: number) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            title="Classify + Scan"
            onClick={(e) => {
              e.stopPropagation();
              onProcess(email.id);
            }}
          >
            Classify
          </Button>
          <Button
            variant="ghost"
            size="sm"
            title="Scan for threats"
            onClick={(e) => {
              e.stopPropagation();
              onScan(email.id);
            }}
          >
            <Shield className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onMoveToFolder(email.id, 'archive');
            }}
          >
            <Archive className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onMoveToFolder(email.id, 'trash');
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
