import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

import { LeadForm, type LeadFormData } from '@/features/module-sales/components/LeadForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCRM } from '@/hooks/useCRM';
import { cn } from '@/lib/utils';
import { sanitizeRichTextHtml, stripHtmlTags } from '@/lib/utils/sanitizer';

import { createLeadWorkspaceEventBus } from '@/features/module-sales/components/lead-workspace-bus';

import { LeadAccountTab } from './leadWorkspace/LeadAccountTab';
import { LeadCommunicationCard } from './leadWorkspace/LeadCommunicationCard';
import { LeadContactsTab } from './leadWorkspace/LeadContactsTab';
import { LeadNarrativeTabs } from './leadWorkspace/LeadNarrativeTabs';
import { useLeadWorkspaceScroll } from './leadWorkspace/useLeadWorkspaceScroll';
import { useLeadWorkspaceTabs } from './leadWorkspace/useLeadWorkspaceTabs';
import { useScrollableKeyDown } from './leadWorkspace/useScrollableKeyDown';
import {
  DEFAULT_BOTTOM_DRAFT,
  DEFAULT_DIRTY,
  DESCRIPTION_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  type AccountDraft,
  type AccountRecord,
  type ActionLoadingState,
  type BottomDraftState,
  type BottomTabKey,
  type BottomTextKey,
  type ContactDraft,
  type ContactRecord,
  type CrudMode,
  type DirtyState,
} from './leadWorkspace/types';
import { isValidEmail, isValidPhone, isValidWebsite, normalizeComparableValue, normalizeWebsite } from './leadWorkspace/helpers';

interface LeadWorkspaceSectionsProps {
  mode: 'create' | 'edit';
  leadId?: string;
  initialData?: Partial<LeadFormData> & { id?: string };
  onSubmit: (data: LeadFormData) => Promise<void>;
  onSaveAndNew?: (data: LeadFormData) => Promise<void>;
  onCancel: () => void;
}

export function LeadWorkspaceSections({
  mode: _mode,
  leadId,
  initialData,
  onSubmit,
  onSaveAndNew,
  onCancel,
}: LeadWorkspaceSectionsProps) {
  const { scopedDb, context } = useCRM();
  const enhancementsEnabled = true;
  const scrollingEnabled = true;
  const eventBusRef = useRef(createLeadWorkspaceEventBus());
  const eventBus = eventBusRef.current;

  const { bottomTab, setBottomTab, communicationTab, setCommunicationTab, loadedBottomTabs, loadedCommunicationTabs } =
    useLeadWorkspaceTabs(enhancementsEnabled);

  const [bottomDraft, setBottomDraft] = useState<BottomDraftState>(DEFAULT_BOTTOM_DRAFT);
  const [dirty, setDirty] = useState<DirtyState>(DEFAULT_DIRTY);
  const [savingBottom, setSavingBottom] = useState(false);
  const [notes, setNotes] = useState<Array<{ id: string; description: string; created_at: string }>>([]);
  const [notesDraft, setNotesDraft] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');
  const [composerSubject, setComposerSubject] = useState('');
  const [composerBody, setComposerBody] = useState('');
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [accountQuery, setAccountQuery] = useState('');
  const [contactQuery, setContactQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [accountDraft, setAccountDraft] = useState<AccountDraft>({ name: '', industry: '', phone: '', website: '' });
  const [contactDraft, setContactDraft] = useState<ContactDraft>({
    first_name: '',
    last_name: '',
    title: '',
    email: '',
    phone: '',
  });
  const [accountActionLoading, setAccountActionLoading] = useState<ActionLoadingState>(null);
  const [contactActionLoading, setContactActionLoading] = useState<ActionLoadingState>(null);
  const [accountValidationError, setAccountValidationError] = useState<string | null>(null);
  const [contactValidationError, setContactValidationError] = useState<string | null>(null);
  const [narrativeValidationError, setNarrativeValidationError] = useState<string | null>(null);
  const descriptionEditorRef = useRef<HTMLDivElement | null>(null);
  const notesEditorRef = useRef<HTMLDivElement | null>(null);

  const { mainSectionRef, bottomSectionRef, communicationSectionRef, scheduleScrollPersist } =
    useLeadWorkspaceScroll(leadId);
  const handleScrollableKeyDown = useScrollableKeyDown();

  const draftStorageKey = useMemo(
    () => (leadId ? `lead.workspace.form.draft.${leadId}` : 'lead.workspace.form.draft.new'),
    [leadId],
  );

  // ─── Hydration: bottom draft from local + remote ─────────────────────
  useEffect(() => {
    const hydrateFromLocal = () => {
      try {
        const raw = localStorage.getItem(`${draftStorageKey}.bottom`);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<BottomDraftState>;
        setBottomDraft((prev) => ({
          ...prev,
          internal_notes: typeof parsed.internal_notes === 'string' ? parsed.internal_notes : prev.internal_notes,
          extra_info: typeof parsed.extra_info === 'string' ? parsed.extra_info : prev.extra_info,
          ai: typeof parsed.ai === 'string' ? parsed.ai : prev.ai,
          lead_information: typeof parsed.lead_information === 'string' ? parsed.lead_information : prev.lead_information,
          description: typeof parsed.description === 'string' ? parsed.description : prev.description,
          notes: typeof parsed.notes === 'string' ? parsed.notes : prev.notes,
        }));
      } catch {
        return;
      }
    };

    if (!leadId) {
      setBottomDraft((prev) => ({
        ...prev,
        description: initialData?.description || prev.description,
        notes: initialData?.notes || prev.notes,
      }));
      const customFields = (initialData as any)?.custom_fields as Record<string, unknown> | undefined;
      setBottomDraft((prev) => ({
        ...prev,
        internal_notes: typeof customFields?.internal_notes === 'string' ? customFields.internal_notes : prev.internal_notes,
        extra_info: typeof customFields?.extra_info === 'string' ? customFields.extra_info : prev.extra_info,
        ai: typeof customFields?.ai === 'string' ? customFields.ai : prev.ai,
        lead_information: typeof customFields?.lead_information === 'string' ? customFields.lead_information : prev.lead_information,
      }));
      setSelectedAccountId(typeof customFields?.account_id === 'string' ? customFields.account_id : null);
      setSelectedContactId(typeof customFields?.contact_id === 'string' ? customFields.contact_id : null);
      hydrateFromLocal();
      return;
    }

    const loadBottomDraft = async () => {
      const { data, error } = await scopedDb
        .from('leads')
        .select('custom_fields, description, notes')
        .eq('id', leadId)
        .single();
      if (error || !data) return;
      const customFields = (data.custom_fields || {}) as Record<string, unknown>;
      setBottomDraft({
        internal_notes: typeof customFields.internal_notes === 'string' ? customFields.internal_notes : '',
        extra_info: typeof customFields.extra_info === 'string' ? customFields.extra_info : '',
        ai: typeof customFields.ai === 'string' ? customFields.ai : '',
        lead_information: typeof customFields.lead_information === 'string' ? customFields.lead_information : '',
        description: typeof data.description === 'string' ? data.description : '',
        notes: typeof data.notes === 'string' ? data.notes : '',
      });
      setSelectedAccountId(typeof customFields.account_id === 'string' ? customFields.account_id : null);
      setSelectedContactId(typeof customFields.contact_id === 'string' ? customFields.contact_id : null);
    };
    loadBottomDraft();
  }, [draftStorageKey, initialData, leadId, scopedDb]);

  useEffect(() => {
    if (!descriptionEditorRef.current) return;
    if (descriptionEditorRef.current.innerHTML !== (bottomDraft.description || '')) {
      descriptionEditorRef.current.innerHTML = bottomDraft.description || '';
    }
  }, [bottomDraft.description]);

  useEffect(() => {
    if (!notesEditorRef.current) return;
    if (notesEditorRef.current.innerHTML !== (bottomDraft.notes || '')) {
      notesEditorRef.current.innerHTML = bottomDraft.notes || '';
    }
  }, [bottomDraft.notes]);

  useEffect(() => {
    try {
      localStorage.setItem(`${draftStorageKey}.bottom`, JSON.stringify(bottomDraft));
    } catch {
      return;
    }
  }, [bottomDraft, draftStorageKey]);

  // ─── Lead-relation update (custom_fields.account_id / contact_id) ────
  const updateLeadRelations = useCallback(
    async (accountId: string | null, contactId: string | null) => {
      if (!leadId) return;
      const { data: leadRow, error: leadFetchError } = await scopedDb
        .from('leads')
        .select('custom_fields')
        .eq('id', leadId)
        .single();
      if (leadFetchError) throw leadFetchError;
      const currentCustomFields =
        leadRow && typeof leadRow.custom_fields === 'object' && leadRow.custom_fields !== null
          ? (leadRow.custom_fields as Record<string, unknown>)
          : {};
      const { error } = await scopedDb
        .from('leads')
        .update({
          custom_fields: {
            ...currentCustomFields,
            account_id: accountId,
            contact_id: contactId,
          },
        })
        .eq('id', leadId);
      if (error) throw error;
    },
    [leadId, scopedDb],
  );

  // ─── Loaders ─────────────────────────────────────────────────────────
  const loadAccounts = useCallback(async () => {
    if (!enhancementsEnabled) return;
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      const { data, error } = await scopedDb
        .from('v_accounts')
        .select('id, name, industry, phone, website')
        .order('updated_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setAccounts((data || []) as AccountRecord[]);
    } catch (error: any) {
      setAccountsError(error?.message || 'Failed to load accounts');
    } finally {
      setAccountsLoading(false);
    }
  }, [enhancementsEnabled, scopedDb]);

  const loadContacts = useCallback(async () => {
    if (!enhancementsEnabled) return;
    setContactsLoading(true);
    setContactsError(null);
    try {
      const baseQuery = scopedDb
        .from('v_contacts')
        .select('id, account_id, first_name, last_name, title, email, phone')
        .order('updated_at', { ascending: false })
        .limit(150);
      const query = selectedAccountId ? baseQuery.eq('account_id', selectedAccountId) : baseQuery;
      const { data, error } = await query;
      if (error) throw error;
      setContacts((data || []) as ContactRecord[]);
    } catch (error: any) {
      setContactsError(error?.message || 'Failed to load contacts');
    } finally {
      setContactsLoading(false);
    }
  }, [enhancementsEnabled, scopedDb, selectedAccountId]);

  useEffect(() => {
    if (!enhancementsEnabled) return;
    loadAccounts();
  }, [enhancementsEnabled, loadAccounts]);

  useEffect(() => {
    if (!enhancementsEnabled) return;
    loadContacts();
  }, [enhancementsEnabled, loadContacts]);

  const loadNotes = useCallback(async () => {
    if (!leadId) return;
    const { data, error } = await scopedDb
      .from('activities')
      .select('id, description, created_at')
      .eq('lead_id', leadId)
      .eq('activity_type', 'note')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return;
    const next = ((data || []) as any[]).map((item) => ({
      id: item.id,
      description: item.description || '',
      created_at: item.created_at || new Date().toISOString(),
    }));
    setNotes(next);
  }, [leadId, scopedDb]);

  useEffect(() => {
    loadNotes();
    const unsubscribe = eventBus.on('notes:refresh', () => {
      loadNotes();
    });
    return unsubscribe;
  }, [eventBus, loadNotes]);

  // ─── Bottom section save + auto-save ─────────────────────────────────
  const saveBottomSection = useCallback(
    async (silent: boolean = false, keys?: BottomTextKey[]) => {
      const dirtyKeys = keys || (Object.keys(dirty) as BottomTextKey[]).filter((key) => dirty[key]);
      if (!leadId) {
        if (!silent) toast.info('Save lead first to persist bottom section');
        return false;
      }
      if (dirtyKeys.length === 0) {
        if (!silent) toast.info('No bottom section changes to save');
        return true;
      }
      try {
        setSavingBottom(true);
        const payload = dirtyKeys.reduce<Record<string, string>>((acc, key) => {
          if (key === 'description' || key === 'notes') return acc;
          acc[key] = bottomDraft[key];
          return acc;
        }, {});
        const { data: leadRow, error: leadFetchError } = await scopedDb
          .from('leads')
          .select('custom_fields')
          .eq('id', leadId)
          .single();
        if (leadFetchError) throw leadFetchError;
        const currentCustomFields =
          leadRow && typeof leadRow.custom_fields === 'object' && leadRow.custom_fields !== null
            ? (leadRow.custom_fields as Record<string, unknown>)
            : {};
        const { error } = await scopedDb
          .from('leads')
          .update({
            ...(dirtyKeys.includes('description') ? { description: bottomDraft.description || null } : {}),
            ...(dirtyKeys.includes('notes') ? { notes: bottomDraft.notes || null } : {}),
            custom_fields: {
              ...currentCustomFields,
              ...payload,
              account_id: selectedAccountId,
              contact_id: selectedContactId,
            },
          })
          .eq('id', leadId);
        if (error) throw error;
        setDirty((prev) => {
          const next = { ...prev };
          dirtyKeys.forEach((key) => {
            next[key] = false;
          });
          return next;
        });
        if (!silent) toast.success('Bottom section saved');
        eventBus.emit('activities:refresh', { source: 'bottom-section-save' });
        return true;
      } catch (error) {
        if (!silent) toast.error('Failed to save bottom section');
        return false;
      } finally {
        setSavingBottom(false);
      }
    },
    [bottomDraft, dirty, eventBus, leadId, scopedDb, selectedAccountId, selectedContactId],
  );

  useEffect(() => {
    if (!leadId || !enhancementsEnabled) return;
    const dirtyKeys = (Object.keys(dirty) as BottomTextKey[]).filter((key) => dirty[key]);
    if (dirtyKeys.length === 0) return;
    const timer = window.setTimeout(() => {
      void saveBottomSection(true, dirtyKeys);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [dirty, enhancementsEnabled, leadId, saveBottomSection]);

  // ─── Notes / message composer ────────────────────────────────────────
  const saveNote = async () => {
    const value = notesDraft.trim();
    if (!leadId || !value) return;
    const { error } = await scopedDb.from('activities').insert({
      lead_id: leadId,
      activity_type: 'note',
      subject: 'Lead note',
      description: value,
      status: 'completed',
    } as any);
    if (error) {
      toast.error('Failed to add note');
      return;
    }
    setNotesDraft('');
    eventBus.emit('notes:refresh', { source: 'add-note' });
    eventBus.emit('activities:refresh', { source: 'add-note' });
  };

  const updateNote = async () => {
    if (!editingNoteId) return;
    const value = editingNoteValue.trim();
    if (!value) return;
    const { error } = await scopedDb.from('activities').update({ description: value } as any).eq('id', editingNoteId);
    if (error) {
      toast.error('Failed to update note');
      return;
    }
    setEditingNoteId(null);
    setEditingNoteValue('');
    eventBus.emit('notes:refresh', { source: 'edit-note' });
    eventBus.emit('activities:refresh', { source: 'edit-note' });
  };

  const applyTemplate = (template: 'follow_up' | 'meeting' | 'proposal') => {
    if (template === 'follow_up') {
      setComposerSubject('Quick follow-up on your lead');
      setComposerBody('Hi,\n\nFollowing up on your requirements. Please share your preferred timeline.\n\nThanks');
      return;
    }
    if (template === 'meeting') {
      setComposerSubject('Scheduling a discovery meeting');
      setComposerBody('Hi,\n\nWould you be available for a 30-minute discovery meeting this week?\n\nBest regards');
      return;
    }
    setComposerSubject('Proposal draft ready');
    setComposerBody('Hi,\n\nWe prepared a draft proposal for your review. Let us know if you want any adjustments.\n\nRegards');
  };

  const sendMessage = async () => {
    if (!leadId) {
      toast.info('Save lead first to send message');
      return;
    }
    if (!composerBody.trim()) {
      toast.error('Message body is required');
      return;
    }
    const { error } = await scopedDb.from('activities').insert({
      lead_id: leadId,
      activity_type: 'email',
      subject: composerSubject || 'Lead message',
      description: composerBody,
      status: 'planned',
    } as any);
    if (error) {
      toast.error('Failed to queue message');
      return;
    }
    toast.success('Message queued');
    setComposerSubject('');
    setComposerBody('');
    eventBus.emit('activities:refresh', { source: 'send-message' });
  };

  // ─── Draft text setter (with length validation) ──────────────────────
  const setDraftValue = (tab: BottomTextKey, value: string) => {
    if (tab === 'description' && stripHtmlTags(value).length > DESCRIPTION_MAX_LENGTH) {
      setNarrativeValidationError(`Description cannot exceed ${DESCRIPTION_MAX_LENGTH} characters`);
      return;
    }
    if (tab === 'notes' && stripHtmlTags(value).length > NOTES_MAX_LENGTH) {
      setNarrativeValidationError(`Notes cannot exceed ${NOTES_MAX_LENGTH} characters`);
      return;
    }
    if (tab === 'description' || tab === 'notes') {
      setNarrativeValidationError(null);
    }
    setBottomDraft((prev) => ({ ...prev, [tab]: value }));
    setDirty((prev) => ({ ...prev, [tab]: true }));
  };

  const execRichText = (
    target: 'description' | 'notes',
    command: 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList',
  ) => {
    const editor = target === 'description' ? descriptionEditorRef.current : notesEditorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command);
    if (target === 'description') {
      setDraftValue('description', sanitizeRichTextHtml(editor.innerHTML));
      return;
    }
    setDraftValue('notes', sanitizeRichTextHtml(editor.innerHTML));
  };

  // ─── Derived state ───────────────────────────────────────────────────
  const filteredAccounts = useMemo(() => {
    const q = accountQuery.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((account) =>
      [account.name, account.industry || '', account.phone || '', account.website || '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [accountQuery, accounts]);

  const filteredContacts = useMemo(() => {
    const q = contactQuery.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((contact) =>
      [contact.first_name, contact.last_name, contact.email || '', contact.phone || '', contact.title || '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [contactQuery, contacts]);

  const selectedAccount = useMemo(
    () => accounts.find((item) => item.id === selectedAccountId) || null,
    [accounts, selectedAccountId],
  );

  const selectedContact = useMemo(
    () => contacts.find((item) => item.id === selectedContactId) || null,
    [contacts, selectedContactId],
  );

  const accountCrudMode = useMemo<CrudMode>(() => {
    if (!selectedAccountId) return 'create';
    if (!selectedAccount) return 'read';
    const persistedWebsite = selectedAccount.website ? normalizeWebsite(selectedAccount.website) : '';
    const draftWebsite = accountDraft.website.trim() ? normalizeWebsite(accountDraft.website.trim()) : '';
    const changed =
      normalizeComparableValue(accountDraft.name) !== normalizeComparableValue(selectedAccount.name) ||
      normalizeComparableValue(accountDraft.industry) !== normalizeComparableValue(selectedAccount.industry) ||
      normalizeComparableValue(accountDraft.phone) !== normalizeComparableValue(selectedAccount.phone) ||
      normalizeComparableValue(draftWebsite) !== normalizeComparableValue(persistedWebsite);
    return changed ? 'update' : 'read';
  }, [accountDraft.industry, accountDraft.name, accountDraft.phone, accountDraft.website, selectedAccount, selectedAccountId]);

  const contactCrudMode = useMemo<CrudMode>(() => {
    if (!selectedContactId) return 'create';
    if (!selectedContact) return 'read';
    const changed =
      normalizeComparableValue(contactDraft.first_name) !== normalizeComparableValue(selectedContact.first_name) ||
      normalizeComparableValue(contactDraft.last_name) !== normalizeComparableValue(selectedContact.last_name) ||
      normalizeComparableValue(contactDraft.title) !== normalizeComparableValue(selectedContact.title) ||
      normalizeComparableValue(contactDraft.email) !== normalizeComparableValue(selectedContact.email) ||
      normalizeComparableValue(contactDraft.phone) !== normalizeComparableValue(selectedContact.phone);
    return changed ? 'update' : 'read';
  }, [contactDraft.email, contactDraft.first_name, contactDraft.last_name, contactDraft.phone, contactDraft.title, selectedContact, selectedContactId]);

  const accountCrudBadgeLabel =
    accountCrudMode === 'read' ? 'Read mode' : accountCrudMode === 'create' ? 'Create mode' : 'Update mode';

  const contactCrudBadgeLabel =
    contactCrudMode === 'read' ? 'Read mode' : contactCrudMode === 'create' ? 'Create mode' : 'Update mode';

  // ─── Account/contact CRUD ────────────────────────────────────────────
  const createAccount = async () => {
    if (!leadId) {
      toast.info('Save lead first to create related account');
      return;
    }
    const name = accountDraft.name.trim();
    const phone = accountDraft.phone.trim();
    const website = accountDraft.website.trim();
    if (!name) {
      toast.error('Account name is required');
      return;
    }
    if (website && !isValidWebsite(website)) {
      setAccountValidationError('Account website must be a valid URL');
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setAccountValidationError('Account phone must be a valid phone number');
      return;
    }
    setAccountValidationError(null);
    try {
      setAccountActionLoading('create');
      const { data, error } = await scopedDb
        .from('v_accounts')
        .insert({
          tenant_id: context.tenantId,
          franchise_id: context.franchiseId,
          name,
          industry: accountDraft.industry || null,
          phone: phone || null,
          website: website ? normalizeWebsite(website) : null,
        } as any)
        .select('id, name, industry, phone, website')
        .single();
      if (error) throw error;
      setAccounts((prev) => [data as AccountRecord, ...prev]);
      setSelectedAccountId((data as AccountRecord).id);
      await updateLeadRelations((data as AccountRecord).id, selectedContactId);
      toast.success('Account created');
    } catch (error: any) {
      toast.error('Failed to create account', { description: error?.message || 'Unknown error' });
    } finally {
      setAccountActionLoading(null);
    }
  };

  const updateAccount = async () => {
    if (!selectedAccountId) {
      toast.info('Select an account to update');
      return;
    }
    const name = accountDraft.name.trim();
    const phone = accountDraft.phone.trim();
    const website = accountDraft.website.trim();
    if (!name) {
      toast.error('Account name is required');
      return;
    }
    if (website && !isValidWebsite(website)) {
      setAccountValidationError('Account website must be a valid URL');
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setAccountValidationError('Account phone must be a valid phone number');
      return;
    }
    setAccountValidationError(null);
    try {
      setAccountActionLoading('update');
      const { data, error } = await scopedDb
        .from('v_accounts')
        .update({
          name,
          industry: accountDraft.industry || null,
          phone: phone || null,
          website: website ? normalizeWebsite(website) : null,
        } as any)
        .eq('id', selectedAccountId)
        .select('id, name, industry, phone, website')
        .single();
      if (error) throw error;
      setAccounts((prev) => prev.map((item) => (item.id === selectedAccountId ? (data as AccountRecord) : item)));
      toast.success('Account updated');
    } catch (error: any) {
      toast.error('Failed to update account', { description: error?.message || 'Unknown error' });
    } finally {
      setAccountActionLoading(null);
    }
  };

  const deleteAccount = async () => {
    if (!selectedAccountId) {
      toast.info('Select an account to delete');
      return;
    }
    try {
      setAccountActionLoading('delete');
      const { error } = await scopedDb.from('v_accounts').delete().eq('id', selectedAccountId);
      if (error) throw error;
      const deletedId = selectedAccountId;
      setAccounts((prev) => prev.filter((item) => item.id !== deletedId));
      setSelectedAccountId(null);
      if (selectedContactId) {
        const linked = contacts.find((item) => item.id === selectedContactId);
        if (linked?.account_id === deletedId) {
          setSelectedContactId(null);
          await updateLeadRelations(null, null);
        } else {
          await updateLeadRelations(null, selectedContactId);
        }
      } else {
        await updateLeadRelations(null, null);
      }
      toast.success('Account deleted');
    } catch (error: any) {
      toast.error('Failed to delete account', { description: error?.message || 'Unknown error' });
    } finally {
      setAccountActionLoading(null);
    }
  };

  const createContact = async () => {
    if (!leadId) {
      toast.info('Save lead first to create related contact');
      return;
    }
    if (!selectedAccountId) {
      toast.error('Select or create an account before adding a contact');
      return;
    }
    const firstName = contactDraft.first_name.trim();
    const lastName = contactDraft.last_name.trim();
    const email = contactDraft.email.trim();
    const phone = contactDraft.phone.trim();
    if (!firstName || !lastName) {
      toast.error('Contact first and last names are required');
      return;
    }
    if (email && !isValidEmail(email)) {
      setContactValidationError('Contact email must be a valid email address');
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setContactValidationError('Contact phone must be a valid phone number');
      return;
    }
    setContactValidationError(null);
    try {
      setContactActionLoading('create');
      const { data, error } = await scopedDb
        .from('v_contacts')
        .insert({
          tenant_id: context.tenantId,
          franchise_id: context.franchiseId,
          account_id: selectedAccountId,
          first_name: firstName,
          last_name: lastName,
          title: contactDraft.title || null,
          email: email || null,
          phone: phone || null,
        } as any)
        .select('id, account_id, first_name, last_name, title, email, phone')
        .single();
      if (error) throw error;
      const nextContact = data as ContactRecord;
      setContacts((prev) => [nextContact, ...prev]);
      setSelectedContactId(nextContact.id);
      if (nextContact.account_id) setSelectedAccountId(nextContact.account_id);
      await updateLeadRelations(nextContact.account_id || selectedAccountId, nextContact.id);
      toast.success('Contact created');
    } catch (error: any) {
      toast.error('Failed to create contact', { description: error?.message || 'Unknown error' });
    } finally {
      setContactActionLoading(null);
    }
  };

  const updateContact = async () => {
    if (!selectedContactId) {
      toast.info('Select a contact to update');
      return;
    }
    const firstName = contactDraft.first_name.trim();
    const lastName = contactDraft.last_name.trim();
    const email = contactDraft.email.trim();
    const phone = contactDraft.phone.trim();
    if (!firstName || !lastName) {
      toast.error('Contact first and last names are required');
      return;
    }
    if (email && !isValidEmail(email)) {
      setContactValidationError('Contact email must be a valid email address');
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setContactValidationError('Contact phone must be a valid phone number');
      return;
    }
    setContactValidationError(null);
    try {
      setContactActionLoading('update');
      const { data, error } = await scopedDb
        .from('v_contacts')
        .update({
          account_id: selectedAccountId,
          first_name: firstName,
          last_name: lastName,
          title: contactDraft.title || null,
          email: email || null,
          phone: phone || null,
        } as any)
        .eq('id', selectedContactId)
        .select('id, account_id, first_name, last_name, title, email, phone')
        .single();
      if (error) throw error;
      setContacts((prev) => prev.map((item) => (item.id === selectedContactId ? (data as ContactRecord) : item)));
      await updateLeadRelations(selectedAccountId, selectedContactId);
      toast.success('Contact updated');
    } catch (error: any) {
      toast.error('Failed to update contact', { description: error?.message || 'Unknown error' });
    } finally {
      setContactActionLoading(null);
    }
  };

  const deleteContact = async () => {
    if (!selectedContactId) {
      toast.info('Select a contact to delete');
      return;
    }
    try {
      setContactActionLoading('delete');
      const { error } = await scopedDb.from('v_contacts').delete().eq('id', selectedContactId);
      if (error) throw error;
      setContacts((prev) => prev.filter((item) => item.id !== selectedContactId));
      setSelectedContactId(null);
      await updateLeadRelations(selectedAccountId, null);
      toast.success('Contact deleted');
    } catch (error: any) {
      toast.error('Failed to delete contact', { description: error?.message || 'Unknown error' });
    } finally {
      setContactActionLoading(null);
    }
  };

  const selectAccount = async (account: AccountRecord) => {
    setSelectedAccountId(account.id);
    setAccountDraft({
      name: account.name || '',
      industry: account.industry || '',
      phone: account.phone || '',
      website: account.website || '',
    });
    if (!leadId) return;
    try {
      await updateLeadRelations(account.id, selectedContactId);
    } catch (error: any) {
      toast.error('Failed to link account', { description: error?.message || 'Unknown error' });
    }
  };

  const selectContact = async (contact: ContactRecord) => {
    setSelectedContactId(contact.id);
    setContactDraft({
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      title: contact.title || '',
      email: contact.email || '',
      phone: contact.phone || '',
    });
    if (contact.account_id) {
      setSelectedAccountId(contact.account_id);
      const selectedAccountForContact = accounts.find((item) => item.id === contact.account_id);
      if (selectedAccountForContact) {
        setAccountDraft({
          name: selectedAccountForContact.name || '',
          industry: selectedAccountForContact.industry || '',
          phone: selectedAccountForContact.phone || '',
          website: selectedAccountForContact.website || '',
        });
      }
    }
    if (!leadId) return;
    try {
      await updateLeadRelations(contact.account_id || selectedAccountId, contact.id);
    } catch (error: any) {
      toast.error('Failed to link contact', { description: error?.message || 'Unknown error' });
    }
  };

  // ─── Draft sync on selection change ──────────────────────────────────
  useEffect(() => {
    if (!selectedAccountId) {
      setAccountDraft({ name: '', industry: '', phone: '', website: '' });
      return;
    }
    const selected = accounts.find((item) => item.id === selectedAccountId);
    if (!selected) return;
    setAccountDraft({
      name: selected.name || '',
      industry: selected.industry || '',
      phone: selected.phone || '',
      website: selected.website || '',
    });
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    if (!selectedContactId) {
      setContactDraft({ first_name: '', last_name: '', title: '', email: '', phone: '' });
      return;
    }
    const selected = contacts.find((item) => item.id === selectedContactId);
    if (!selected) return;
    setContactDraft({
      first_name: selected.first_name || '',
      last_name: selected.last_name || '',
      title: selected.title || '',
      email: selected.email || '',
      phone: selected.phone || '',
    });
  }, [contacts, selectedContactId]);

  const dirtyCount = useMemo(
    () => (Object.keys(dirty) as BottomTextKey[]).filter((key) => dirty[key]).length,
    [dirty],
  );

  // ─── Submit handlers (merge bottom draft into form payload) ──────────
  const handleMainSubmit = async (data: LeadFormData) => {
    await onSubmit({
      ...data,
      description: bottomDraft.description || data.description || '',
      notes: bottomDraft.notes || data.notes || '',
      custom_fields: {
        ...(data as any).custom_fields,
        account_id: selectedAccountId,
        contact_id: selectedContactId,
      } as any,
    } as LeadFormData);
  };

  const handleMainSaveAndNew = onSaveAndNew
    ? async (data: LeadFormData) => {
        await onSaveAndNew({
          ...data,
          description: bottomDraft.description || data.description || '',
          notes: bottomDraft.notes || data.notes || '',
          custom_fields: {
            ...(data as any).custom_fields,
            account_id: selectedAccountId,
            contact_id: selectedContactId,
          } as any,
        } as LeadFormData);
      }
    : undefined;

  return (
    <div
      className={cn(
        'lead-workspace-tight-lines grid grid-cols-1 gap-6 xl:grid-cols-12',
        scrollingEnabled && 'xl:h-[calc(100vh-12.5rem)] xl:overflow-hidden',
      )}
    >
      <div
        className={cn(
          'space-y-6 xl:col-span-8',
          scrollingEnabled &&
            'xl:grid xl:h-full xl:min-h-0 xl:grid-rows-[minmax(320px,1.2fr)_minmax(280px,1fr)] xl:gap-6 xl:space-y-0 xl:overflow-hidden',
        )}
      >
        <Card className={cn(scrollingEnabled && 'xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden')}>
          <CardContent
            ref={mainSectionRef}
            className={cn(
              'pt-4',
              scrollingEnabled &&
                'xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overscroll-contain xl:scroll-smooth xl:pr-2 xl:scrollbar-thin xl:scrollbar-thumb-gray-300 xl:scrollbar-track-transparent dark:xl:scrollbar-thumb-gray-600 xl:touch-pan-y xl:relative xl:z-10',
            )}
            tabIndex={0}
            onScroll={(event) => scheduleScrollPersist('main', event.currentTarget.scrollTop)}
            onKeyDown={handleScrollableKeyDown}
            aria-label="Main lead section"
          >
            <LeadForm
              initialData={initialData}
              onSubmit={handleMainSubmit}
              onSaveAndNew={handleMainSaveAndNew}
              onCancel={onCancel}
              autoSave
              draftStorageKey={draftStorageKey}
              sectionDescription="Lead profile details and qualification fields"
              hideNarrativeFields={enhancementsEnabled}
            />
          </CardContent>
        </Card>

        <Card className={cn(scrollingEnabled && 'xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden xl:border-t xl:border-border/70')}>
          <CardHeader className={cn('pb-2', scrollingEnabled && 'xl:sticky xl:top-0 xl:z-10 xl:border-b xl:bg-card')}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CardTitle>Details</CardTitle>
                {dirtyCount > 0 ? <Badge variant="outline">{dirtyCount}</Badge> : null}
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      onClick={() => void saveBottomSection(false)}
                      disabled={savingBottom}
                      aria-label="Save details"
                      title="Save"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent
            ref={bottomSectionRef}
            className={cn(
              scrollingEnabled &&
                'xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overscroll-contain xl:scroll-smooth xl:pr-2 xl:scrollbar-thin xl:scrollbar-thumb-gray-300 xl:scrollbar-track-transparent dark:xl:scrollbar-thumb-gray-600 xl:touch-pan-y xl:relative xl:z-10',
            )}
            tabIndex={0}
            onScroll={(event) => scheduleScrollPersist('bottom', event.currentTarget.scrollTop)}
            onKeyDown={handleScrollableKeyDown}
            aria-label="Lead details section"
          >
            <Tabs value={bottomTab} onValueChange={(value) => setBottomTab(value as BottomTabKey)}>
              <TabsList className="sticky top-0 z-10 mb-3 w-full justify-start overflow-auto bg-card">
                {enhancementsEnabled ? <TabsTrigger value="account">Account</TabsTrigger> : null}
                {enhancementsEnabled ? <TabsTrigger value="contacts">Contacts</TabsTrigger> : null}
                <TabsTrigger value="internal_notes">
                  {enhancementsEnabled ? 'Internal Notes and Extra Info' : 'Internal Notes'}
                </TabsTrigger>
                <TabsTrigger value="extra_info">Extra Info</TabsTrigger>
                <TabsTrigger value="ai">AI</TabsTrigger>
                <TabsTrigger value="lead_information">Lead Information</TabsTrigger>
              </TabsList>
              {enhancementsEnabled ? (
                <TabsContent value="account" className="space-y-4">
                  <LeadAccountTab
                    loaded={loadedBottomTabs.has('account')}
                    accountQuery={accountQuery}
                    setAccountQuery={setAccountQuery}
                    accountValidationError={accountValidationError}
                    accountsError={accountsError}
                    filteredAccounts={filteredAccounts}
                    accountsLoading={accountsLoading}
                    selectedAccountId={selectedAccountId}
                    accountDraft={accountDraft}
                    setAccountDraft={setAccountDraft}
                    accountCrudMode={accountCrudMode}
                    accountCrudBadgeLabel={accountCrudBadgeLabel}
                    accountActionLoading={accountActionLoading}
                    leadId={leadId}
                    onCreate={createAccount}
                    onUpdate={updateAccount}
                    onDelete={deleteAccount}
                    onSelect={(account) => void selectAccount(account)}
                    onKeyDown={handleScrollableKeyDown}
                  />
                </TabsContent>
              ) : null}
              {enhancementsEnabled ? (
                <TabsContent value="contacts" className="space-y-4">
                  <LeadContactsTab
                    loaded={loadedBottomTabs.has('contacts')}
                    contactQuery={contactQuery}
                    setContactQuery={setContactQuery}
                    contactValidationError={contactValidationError}
                    contactsError={contactsError}
                    filteredContacts={filteredContacts}
                    contactsLoading={contactsLoading}
                    selectedContactId={selectedContactId}
                    contactDraft={contactDraft}
                    setContactDraft={setContactDraft}
                    contactCrudMode={contactCrudMode}
                    contactCrudBadgeLabel={contactCrudBadgeLabel}
                    contactActionLoading={contactActionLoading}
                    leadId={leadId}
                    onCreate={createContact}
                    onUpdate={updateContact}
                    onDelete={deleteContact}
                    onSelect={(contact) => void selectContact(contact)}
                    onKeyDown={handleScrollableKeyDown}
                  />
                </TabsContent>
              ) : null}
              <LeadNarrativeTabs
                enhancementsEnabled={enhancementsEnabled}
                loadedBottomTabs={loadedBottomTabs}
                bottomDraft={bottomDraft}
                setDraftValue={setDraftValue}
                execRichText={execRichText}
                narrativeValidationError={narrativeValidationError}
                descriptionEditorRef={descriptionEditorRef}
                notesEditorRef={notesEditorRef}
                setBottomTab={setBottomTab}
              />
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className={cn('xl:col-span-4', scrollingEnabled && 'xl:h-full xl:min-h-0 xl:overflow-hidden')}>
        <LeadCommunicationCard
          scrollingEnabled={scrollingEnabled}
          containerRef={communicationSectionRef}
          onScroll={(event) => scheduleScrollPersist('communication', event.currentTarget.scrollTop)}
          onKeyDown={handleScrollableKeyDown}
          communicationTab={communicationTab}
          setCommunicationTab={setCommunicationTab}
          loadedCommunicationTabs={loadedCommunicationTabs}
          composerSubject={composerSubject}
          setComposerSubject={setComposerSubject}
          composerBody={composerBody}
          setComposerBody={setComposerBody}
          applyTemplate={applyTemplate}
          sendMessage={sendMessage}
          notes={notes}
          notesDraft={notesDraft}
          setNotesDraft={setNotesDraft}
          editingNoteId={editingNoteId}
          setEditingNoteId={setEditingNoteId}
          editingNoteValue={editingNoteValue}
          setEditingNoteValue={setEditingNoteValue}
          saveNote={saveNote}
          updateNote={updateNote}
          leadId={leadId}
          eventBus={eventBus}
        />
      </div>
    </div>
  );
}
