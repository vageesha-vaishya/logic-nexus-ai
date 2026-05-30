import { Mail } from 'lucide-react';

import { Card } from '@/components/ui/card';

import { EmailRow } from './EmailRow';
import { ThreadRow } from './ThreadRow';
import type { DuplicateMap, Email, ThreadGroup } from './types';

interface MessageListProps {
  loading: boolean;
  conversationView: boolean;
  emails: Email[];
  threads: ThreadGroup[];
  duplicateMap: DuplicateMap;
  onOpen: (email: Email) => void;
  onToggleStar: (id: string, isStarred: boolean) => void;
  onUpdatePriority: (id: string, priority: string) => void;
  onProcess: (id: string) => void;
  onScan: (id: string) => void;
  onMoveToFolder: (id: string, folder: string) => void;
}

export function MessageList(props: MessageListProps) {
  const {
    loading,
    conversationView,
    emails,
    threads,
    duplicateMap,
    onOpen,
    onToggleStar,
    onUpdatePriority,
    onProcess,
    onScan,
    onMoveToFolder,
  } = props;

  if (loading) {
    return (
      <Card>
        <div className="p-8 text-center text-muted-foreground">Loading emails...</div>
      </Card>
    );
  }

  if (conversationView) {
    if (threads.length === 0) {
      return (
        <Card>
          <EmptyState label="No threads found" />
        </Card>
      );
    }
    return (
      <Card>
        <div className="divide-y">
          {threads.map((t) => (
            <ThreadRow key={t.id} thread={t} duplicateMap={duplicateMap} onOpen={onOpen} />
          ))}
        </div>
      </Card>
    );
  }

  if (emails.length === 0) {
    return (
      <Card>
        <EmptyState label="No emails found" />
      </Card>
    );
  }

  return (
    <Card>
      <div className="divide-y">
        {emails.map((email) => (
          <EmailRow
            key={email.id}
            email={email}
            duplicateMap={duplicateMap}
            onOpen={onOpen}
            onToggleStar={onToggleStar}
            onUpdatePriority={onUpdatePriority}
            onProcess={onProcess}
            onScan={onScan}
            onMoveToFolder={onMoveToFolder}
          />
        ))}
      </div>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="p-8 text-center text-muted-foreground">
      <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p>{label}</p>
    </div>
  );
}
