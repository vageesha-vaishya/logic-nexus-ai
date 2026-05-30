import { Plus, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface InboxToolbarProps {
  syncing: boolean;
  onRefresh: () => void;
  onSync: () => void;
  onSyncAll: () => void;
  onCompose: () => void;
}

export function InboxToolbar({ syncing, onRefresh, onSync, onSyncAll, onCompose }: InboxToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">Email Inbox</h2>
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
        <Button variant="outline" size="sm" onClick={onSync} disabled={syncing}>
          <RefreshCw className={`w-4 h-4 sm:mr-2 ${syncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Sync</span>
        </Button>
        <Button variant="outline" size="sm" onClick={onSyncAll} disabled={syncing}>
          <RefreshCw className={`w-4 h-4 sm:mr-2 ${syncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Sync All</span>
        </Button>
        <Button size="sm" onClick={onCompose}>
          <Plus className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Compose</span>
        </Button>
      </div>
    </div>
  );
}
