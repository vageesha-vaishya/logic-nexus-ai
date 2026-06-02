import { useState } from 'react';

import { EmailComposeDialog } from './EmailComposeDialog';
import { EmailDetailDialog } from './EmailDetailDialog';
import { InboxFiltersBar } from './inbox/InboxFiltersBar';
import { InboxToolbar } from './inbox/InboxToolbar';
import { MessageList } from './inbox/MessageList';
import type { Email } from './inbox/types';
import { useEmailInbox } from './inbox/useEmailInbox';

export function EmailInbox() {
  const inbox = useEmailInbox();
  const [showCompose, setShowCompose] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  const handleOpen = (email: Email) => {
    setSelectedEmail(email);
    setShowDetail(true);
    if (!email.is_read) {
      void inbox.markAsRead(email.id);
    }
  };

  return (
    <div className="space-y-6 font-outlook">
      <InboxToolbar
        syncing={inbox.syncing}
        onRefresh={() => void inbox.fetchEmails()}
        onSync={() => void inbox.syncEmails()}
        onSyncAll={() => void inbox.syncAllMailboxes()}
        onCompose={() => setShowCompose(true)}
      />

      <InboxFiltersBar
        searchQuery={inbox.searchQuery}
        onSearchQueryChange={inbox.setSearchQuery}
        accounts={inbox.accounts}
        selectedAccountId={inbox.selectedAccountId}
        onSelectedAccountIdChange={inbox.setSelectedAccountId}
        selectedFolder={inbox.selectedFolder}
        onSelectedFolderChange={inbox.setSelectedFolder}
        sortField={inbox.sortField}
        onSortFieldChange={inbox.setSortField}
        sortDirection={inbox.sortDirection}
        onSortDirectionToggle={() =>
          inbox.setSortDirection(inbox.sortDirection === 'asc' ? 'desc' : 'asc')
        }
        conversationView={inbox.conversationView}
        onConversationViewChange={inbox.setConversationView}
      />

      <MessageList
        loading={inbox.loading}
        conversationView={inbox.conversationView}
        emails={inbox.emails}
        threads={inbox.threads}
        duplicateMap={inbox.duplicateMap}
        onOpen={handleOpen}
        onToggleStar={(id, starred) => void inbox.toggleStar(id, starred)}
        onUpdatePriority={(id, p) => void inbox.updateEmailPriority(id, p)}
        onProcess={(id) => void inbox.processEmail(id)}
        onScan={(id) => void inbox.scanEmail(id)}
        onMoveToFolder={(id, folder) => void inbox.moveToFolder(id, folder)}
      />

      <EmailComposeDialog open={showCompose} onOpenChange={setShowCompose} />

      {selectedEmail && (
        <EmailDetailDialog
          open={showDetail}
          onOpenChange={setShowDetail}
          email={selectedEmail}
          onRefresh={() => void inbox.fetchEmails()}
        />
      )}
    </div>
  );
}
