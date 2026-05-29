// Account-tab subtree extracted from LeadWorkspaceSections.tsx.
// Owns no state of its own — receives slices via props from the
// parent orchestrator.

import type { KeyboardEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { AccountDraft, AccountRecord, ActionLoadingState, CrudMode } from './types';

interface LeadAccountTabProps {
  loaded: boolean;
  accountQuery: string;
  setAccountQuery: (value: string) => void;
  accountValidationError: string | null;
  accountsError: string | null;
  filteredAccounts: AccountRecord[];
  accountsLoading: boolean;
  selectedAccountId: string | null;
  accountDraft: AccountDraft;
  setAccountDraft: (updater: (prev: AccountDraft) => AccountDraft) => void;
  accountCrudMode: CrudMode;
  accountCrudBadgeLabel: string;
  accountActionLoading: ActionLoadingState;
  leadId: string | undefined;
  onCreate: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  onSelect: (account: AccountRecord) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

export function LeadAccountTab({
  loaded,
  accountQuery,
  setAccountQuery,
  accountValidationError,
  accountsError,
  filteredAccounts,
  accountsLoading,
  selectedAccountId,
  accountDraft,
  setAccountDraft,
  accountCrudMode,
  accountCrudBadgeLabel,
  accountActionLoading,
  leadId,
  onCreate,
  onUpdate,
  onDelete,
  onSelect,
  onKeyDown,
}: LeadAccountTabProps) {
  if (!loaded) return null;
  return (
    <>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border bg-card/95 p-2 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <Input
          value={accountQuery}
          onChange={(e) => setAccountQuery(e.target.value)}
          placeholder="Search account"
          className="w-full md:max-w-[360px]"
        />
        <div className="flex w-full flex-wrap items-center gap-2 md:ml-auto md:w-auto md:justify-end">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  className="h-9 w-9 bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={onCreate}
                  disabled={!leadId || !!accountActionLoading}
                  aria-label={accountActionLoading === 'create' ? 'Creating account' : 'Create account'}
                  title="Create"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Create</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  className="h-9 w-9 bg-blue-600 text-white hover:bg-blue-700"
                  onClick={onUpdate}
                  disabled={!selectedAccountId || !!accountActionLoading}
                  aria-label={accountActionLoading === 'update' ? 'Updating account' : 'Update account'}
                  title="Update"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Update</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  className="h-9 w-9 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={onDelete}
                  disabled={!selectedAccountId || !!accountActionLoading}
                  aria-label={accountActionLoading === 'delete' ? 'Deleting account' : 'Delete account'}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      {accountValidationError ? <p className="text-sm text-destructive">{accountValidationError}</p> : null}
      {accountsError ? <p className="text-sm text-destructive">{accountsError}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border">
          <div
            className="max-h-[220px] overflow-y-auto overscroll-contain p-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent dark:scrollbar-thumb-gray-600"
            tabIndex={0}
            onKeyDown={onKeyDown}
          >
            {accountsLoading ? <p className="text-sm text-muted-foreground p-2">Loading accounts...</p> : null}
            {!accountsLoading && filteredAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">No accounts found</p>
            ) : null}
            {filteredAccounts.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => onSelect(account)}
                className={cn(
                  'w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                  selectedAccountId === account.id && 'bg-primary/10 ring-1 ring-primary/30',
                )}
              >
                <p className="font-medium">{account.name}</p>
                <p className="text-xs text-muted-foreground">{account.industry || 'No industry'}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Account CRUD state</p>
            <Badge
              role="status"
              aria-live="polite"
              aria-label={`Account ${accountCrudBadgeLabel.toLowerCase()}`}
              variant={accountCrudMode === 'read' ? 'secondary' : accountCrudMode === 'create' ? 'default' : 'warning'}
              className="capitalize"
            >
              {accountCrudBadgeLabel}
            </Badge>
          </div>
          <Input
            value={accountDraft.name}
            onChange={(e) => setAccountDraft((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Account Name *"
          />
          <Input
            value={accountDraft.industry}
            onChange={(e) => setAccountDraft((prev) => ({ ...prev, industry: e.target.value }))}
            placeholder="Industry"
          />
          <Input
            value={accountDraft.phone}
            onChange={(e) => setAccountDraft((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="Phone"
          />
          <Input
            value={accountDraft.website}
            onChange={(e) => setAccountDraft((prev) => ({ ...prev, website: e.target.value }))}
            placeholder="Website"
          />
        </div>
      </div>
    </>
  );
}
