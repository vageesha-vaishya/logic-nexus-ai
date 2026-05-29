// Contacts-tab subtree extracted from LeadWorkspaceSections.tsx.

import type { KeyboardEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { ActionLoadingState, ContactDraft, ContactRecord, CrudMode } from './types';

interface LeadContactsTabProps {
  loaded: boolean;
  contactQuery: string;
  setContactQuery: (value: string) => void;
  contactValidationError: string | null;
  contactsError: string | null;
  filteredContacts: ContactRecord[];
  contactsLoading: boolean;
  selectedContactId: string | null;
  contactDraft: ContactDraft;
  setContactDraft: (updater: (prev: ContactDraft) => ContactDraft) => void;
  contactCrudMode: CrudMode;
  contactCrudBadgeLabel: string;
  contactActionLoading: ActionLoadingState;
  leadId: string | undefined;
  onCreate: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  onSelect: (contact: ContactRecord) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

export function LeadContactsTab({
  loaded,
  contactQuery,
  setContactQuery,
  contactValidationError,
  contactsError,
  filteredContacts,
  contactsLoading,
  selectedContactId,
  contactDraft,
  setContactDraft,
  contactCrudMode,
  contactCrudBadgeLabel,
  contactActionLoading,
  leadId,
  onCreate,
  onUpdate,
  onDelete,
  onSelect,
  onKeyDown,
}: LeadContactsTabProps) {
  if (!loaded) return null;
  return (
    <>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border bg-card/95 p-2 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <Input
          value={contactQuery}
          onChange={(e) => setContactQuery(e.target.value)}
          placeholder="Search contact"
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
                  disabled={!leadId || !!contactActionLoading}
                  aria-label={contactActionLoading === 'create' ? 'Creating contact' : 'Create contact'}
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
                  disabled={!selectedContactId || !!contactActionLoading}
                  aria-label={contactActionLoading === 'update' ? 'Updating contact' : 'Update contact'}
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
                  disabled={!selectedContactId || !!contactActionLoading}
                  aria-label={contactActionLoading === 'delete' ? 'Deleting contact' : 'Delete contact'}
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
      {contactValidationError ? <p className="text-sm text-destructive">{contactValidationError}</p> : null}
      {contactsError ? <p className="text-sm text-destructive">{contactsError}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border">
          <div
            className="max-h-[220px] overflow-y-auto overscroll-contain p-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent dark:scrollbar-thumb-gray-600"
            tabIndex={0}
            onKeyDown={onKeyDown}
          >
            {contactsLoading ? <p className="text-sm text-muted-foreground p-2">Loading contacts...</p> : null}
            {!contactsLoading && filteredContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">No contacts found</p>
            ) : null}
            {filteredContacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => onSelect(contact)}
                className={cn(
                  'w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                  selectedContactId === contact.id && 'bg-primary/10 ring-1 ring-primary/30',
                )}
              >
                <p className="font-medium">
                  {contact.first_name} {contact.last_name}
                </p>
                <p className="text-xs text-muted-foreground">{contact.email || contact.phone || 'No contact channel'}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Contact CRUD state</p>
            <Badge
              role="status"
              aria-live="polite"
              aria-label={`Contact ${contactCrudBadgeLabel.toLowerCase()}`}
              variant={contactCrudMode === 'read' ? 'secondary' : contactCrudMode === 'create' ? 'default' : 'warning'}
              className="capitalize"
            >
              {contactCrudBadgeLabel}
            </Badge>
          </div>
          <Input
            value={contactDraft.first_name}
            onChange={(e) => setContactDraft((prev) => ({ ...prev, first_name: e.target.value }))}
            placeholder="First Name *"
          />
          <Input
            value={contactDraft.last_name}
            onChange={(e) => setContactDraft((prev) => ({ ...prev, last_name: e.target.value }))}
            placeholder="Last Name *"
          />
          <Input
            value={contactDraft.title}
            onChange={(e) => setContactDraft((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Title"
          />
          <Input
            value={contactDraft.email}
            onChange={(e) => setContactDraft((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="Email"
          />
          <Input
            value={contactDraft.phone}
            onChange={(e) => setContactDraft((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="Phone"
          />
        </div>
      </div>
    </>
  );
}
