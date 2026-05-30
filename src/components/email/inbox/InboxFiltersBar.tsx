import { ArrowUpDown, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { EmailAccount, SortDirection, SortField } from './types';

interface InboxFiltersBarProps {
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  accounts: EmailAccount[];
  selectedAccountId: string;
  onSelectedAccountIdChange: (id: string) => void;
  selectedFolder: string;
  onSelectedFolderChange: (folder: string) => void;
  sortField: SortField;
  onSortFieldChange: (f: SortField) => void;
  sortDirection: SortDirection;
  onSortDirectionToggle: () => void;
  conversationView: boolean;
  onConversationViewChange: (v: boolean) => void;
}

export function InboxFiltersBar(props: InboxFiltersBarProps) {
  const {
    searchQuery,
    onSearchQueryChange,
    accounts,
    selectedAccountId,
    onSelectedAccountIdChange,
    selectedFolder,
    onSelectedFolderChange,
    sortField,
    onSortFieldChange,
    sortDirection,
    onSortDirectionToggle,
    conversationView,
    onConversationViewChange,
  } = props;

  return (
    <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
      <div className="relative w-full sm:w-[220px] lg:w-[240px]">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="pl-10"
        />
      </div>
      <div className="w-full lg:w-[280px]">
        <Select onValueChange={onSelectedAccountIdChange} value={selectedAccountId || undefined}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select mailbox" />
          </SelectTrigger>
          <SelectContent>
            {accounts.length === 0 ? (
              <SelectItem value="none" disabled>
                No accounts
              </SelectItem>
            ) : (
              accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.email_address} {a.is_primary ? '(Primary)' : ''}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full lg:flex-1 overflow-x-auto">
        <Tabs value={selectedFolder} onValueChange={onSelectedFolderChange} className="w-full">
          <TabsList className="flex w-full whitespace-nowrap">
            <TabsTrigger value="inbox">Inbox</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="drafts">Drafts</TabsTrigger>
            <TabsTrigger value="archive">Archive</TabsTrigger>
            <TabsTrigger value="trash">Trash</TabsTrigger>
            <TabsTrigger
              value="quarantine"
              className="text-red-500 data-[state=active]:text-red-600"
            >
              Quarantine
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="w-full lg:w-auto flex items-center gap-2 shrink-0">
        <Select value={sortField} onValueChange={(v) => onSortFieldChange(v as SortField)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="received_at">Date</SelectItem>
            <SelectItem value="from_email">From</SelectItem>
            <SelectItem value="subject">Subject</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={onSortDirectionToggle}
          className="flex items-center gap-2"
        >
          <ArrowUpDown className="w-4 h-4" />
          {sortDirection === 'asc' ? 'Asc' : 'Desc'}
        </Button>
        <div className="flex items-center gap-2 pl-2 border-l">
          <Switch
            id="conversation-view"
            checked={conversationView}
            onCheckedChange={onConversationViewChange}
            className="h-5 w-9"
          />
          <Label htmlFor="conversation-view" className="text-xs whitespace-nowrap cursor-pointer">
            Threads
          </Label>
        </div>
      </div>
    </div>
  );
}
