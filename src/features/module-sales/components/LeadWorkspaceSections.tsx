import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LeadForm, type LeadFormData } from '@/features/module-sales/components/LeadForm';
import { LeadActivitiesTimeline } from '@/features/module-sales/components/LeadActivitiesTimeline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Bold, Italic, List, ListOrdered, Plus, Save, Trash2, Underline, Pencil, Send } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { createLeadWorkspaceEventBus } from '@/features/module-sales/components/lead-workspace-bus';
import { cn } from '@/lib/utils';
import { sanitizeRichTextHtml, stripHtmlTags } from '@/lib/utils/sanitizer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type BottomTabKey = 'account' | 'contacts' | 'internal_notes' | 'extra_info' | 'ai' | 'lead_information';
type CommunicationTabKey = 'send_message' | 'notes' | 'lead_activities';
type BottomTextKey = 'internal_notes' | 'extra_info' | 'ai' | 'lead_information' | 'description' | 'notes';
type ScrollSectionKey = 'main' | 'bottom' | 'communication';
type CrudMode = 'create' | 'read' | 'update';
type BottomDraftState = Record<BottomTextKey, string>;
type DirtyState = Record<BottomTextKey, boolean>;

interface AccountRecord {
  id: string;
  name: string;
  industry: string | null;
  phone: string | null;
  website: string | null;
}

interface ContactRecord {
  id: string;
  account_id: string | null;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
}

interface LeadWorkspaceSectionsProps {
  mode: 'create' | 'edit';
  leadId?: string;
  initialData?: Partial<LeadFormData> & { id?: string };
  onSubmit: (data: LeadFormData) => Promise<void>;
  onSaveAndNew?: (data: LeadFormData) => Promise<void>;
  onCancel: () => void;
}

const DEFAULT_BOTTOM_DRAFT: BottomDraftState = {
  internal_notes: '',
  extra_info: '',
  ai: '',
  lead_information: '',
  description: '',
  notes: '',
};

const DEFAULT_DIRTY: DirtyState = {
  internal_notes: false,
  extra_info: false,
  ai: false,
  lead_information: false,
  description: false,
  notes: false,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9()\-\s]{7,20}$/;
const DESCRIPTION_MAX_LENGTH = 5000;
const NOTES_MAX_LENGTH = 10000;

function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(value);
}

function isValidPhone(value: string) {
  return PHONE_PATTERN.test(value);
}

function normalizeWebsite(value: string) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function isValidWebsite(value: string) {
  try {
    const parsed = new URL(normalizeWebsite(value));
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function normalizeComparableValue(value: string | null | undefined) {
  return (value || '').trim().toLowerCase();
}

export function LeadWorkspaceSections({
  mode,
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
  const [bottomTab, setBottomTab] = useState<BottomTabKey>('account');
  const [communicationTab, setCommunicationTab] = useState<CommunicationTabKey>('send_message');
  const [loadedBottomTabs, setLoadedBottomTabs] = useState<Set<BottomTabKey>>(new Set(['account']));
  const [loadedCommunicationTabs, setLoadedCommunicationTabs] = useState<Set<CommunicationTabKey>>(new Set(['send_message']));
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
  const [accountDraft, setAccountDraft] = useState({ name: '', industry: '', phone: '', website: '' });
  const [contactDraft, setContactDraft] = useState({ first_name: '', last_name: '', title: '', email: '', phone: '' });
  const [accountActionLoading, setAccountActionLoading] = useState<'create' | 'update' | 'delete' | null>(null);
  const [contactActionLoading, setContactActionLoading] = useState<'create' | 'update' | 'delete' | null>(null);
  const [accountValidationError, setAccountValidationError] = useState<string | null>(null);
  const [contactValidationError, setContactValidationError] = useState<string | null>(null);
  const [narrativeValidationError, setNarrativeValidationError] = useState<string | null>(null);
  const descriptionEditorRef = useRef<HTMLDivElement | null>(null);
  const notesEditorRef = useRef<HTMLDivElement | null>(null);
  const mainSectionRef = useRef<HTMLDivElement | null>(null);
  const bottomSectionRef = useRef<HTMLDivElement | null>(null);
  const communicationSectionRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollRef = useRef<Partial<Record<ScrollSectionKey, number>>>({});
  const scrollWriteFrameRef = useRef<number | null>(null);
  const draftStorageKey = useMemo(
    () => (leadId ? `lead.workspace.form.draft.${leadId}` : 'lead.workspace.form.draft.new'),
    [leadId],
  );
  const scrollStorageKey = useMemo(
    () => (leadId ? `lead.workspace.scroll.${leadId}` : 'lead.workspace.scroll.new'),
    [leadId],
  );

  useEffect(() => {
    if (!enhancementsEnabled) {
      setBottomTab('internal_notes');
      setLoadedBottomTabs(new Set(['internal_notes']));
      return;
    }
    setBottomTab('account');
    setLoadedBottomTabs(new Set(['account']));
  }, [enhancementsEnabled]);

  useEffect(() => {
    setLoadedBottomTabs((prev) => {
      if (prev.has(bottomTab)) return prev;
      const next = new Set(prev);
      next.add(bottomTab);
      return next;
    });
  }, [bottomTab]);

  useEffect(() => {
    setLoadedCommunicationTabs((prev) => {
      if (prev.has(communicationTab)) return prev;
      const next = new Set(prev);
      next.add(communicationTab);
      return next;
    });
  }, [communicationTab]);

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

  const flushScrollPositions = useCallback(() => {
    scrollWriteFrameRef.current = null;
    const hasPending =
      typeof pendingScrollRef.current.main === 'number' ||
      typeof pendingScrollRef.current.bottom === 'number' ||
      typeof pendingScrollRef.current.communication === 'number';
    if (!hasPending) return;
    try {
      const raw = localStorage.getItem(scrollStorageKey);
      const parsed = raw ? (JSON.parse(raw) as Partial<Record<ScrollSectionKey, number>>) : {};
      localStorage.setItem(
        scrollStorageKey,
        JSON.stringify({
          ...parsed,
          ...pendingScrollRef.current,
        }),
      );
      pendingScrollRef.current = {};
    } catch {
      return;
    }
  }, [scrollStorageKey]);

  const scheduleScrollPersist = useCallback(
    (section: ScrollSectionKey, scrollTop: number) => {
      pendingScrollRef.current[section] = scrollTop;
      if (typeof window === 'undefined') return;
      if (scrollWriteFrameRef.current !== null) return;
      scrollWriteFrameRef.current = window.requestAnimationFrame(flushScrollPositions);
    },
    [flushScrollPositions],
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(scrollStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<ScrollSectionKey, number>>;
      if (mainSectionRef.current && typeof parsed.main === 'number') {
        mainSectionRef.current.scrollTop = parsed.main;
      }
      if (bottomSectionRef.current && typeof parsed.bottom === 'number') {
        bottomSectionRef.current.scrollTop = parsed.bottom;
      }
      if (communicationSectionRef.current && typeof parsed.communication === 'number') {
        communicationSectionRef.current.scrollTop = parsed.communication;
      }
    } catch {
      return;
    }
  }, [scrollStorageKey]);

  useEffect(
    () => () => {
      if (scrollWriteFrameRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(scrollWriteFrameRef.current);
        scrollWriteFrameRef.current = null;
      }
      flushScrollPositions();
    },
    [flushScrollPositions],
  );

  const updateLeadRelations = useCallback(async (accountId: string | null, contactId: string | null) => {
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
  }, [leadId, scopedDb]);

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
    const next = ((data || []) as any[])
      .map((item) => ({
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

  const saveBottomSection = useCallback(async (silent: boolean = false, keys?: BottomTextKey[]) => {
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
  }, [bottomDraft, dirty, eventBus, leadId, scopedDb, selectedAccountId, selectedContactId]);

  useEffect(() => {
    if (!leadId || !enhancementsEnabled) return;
    const dirtyKeys = (Object.keys(dirty) as BottomTextKey[]).filter((key) => dirty[key]);
    if (dirtyKeys.length === 0) return;
    const timer = window.setTimeout(() => {
      void saveBottomSection(true, dirtyKeys);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [dirty, enhancementsEnabled, leadId, saveBottomSection]);

  const saveNote = async () => {
    const value = notesDraft.trim();
    if (!leadId || !value) return;
    const { error } = await scopedDb
      .from('activities')
      .insert({
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
    const { error } = await scopedDb
      .from('activities')
      .update({ description: value } as any)
      .eq('id', editingNoteId);
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
    const { error } = await scopedDb
      .from('activities')
      .insert({
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

  const execRichText = (target: 'description' | 'notes', command: 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList') => {
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

  const handleScrollableKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const pageOffset = Math.max(120, Math.floor(container.clientHeight * 0.8));
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      container.scrollBy({ top: 48, behavior: 'smooth' });
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      container.scrollBy({ top: -48, behavior: 'smooth' });
      return;
    }
    if (event.key === 'PageDown') {
      event.preventDefault();
      container.scrollBy({ top: pageOffset, behavior: 'smooth' });
      return;
    }
    if (event.key === 'PageUp') {
      event.preventDefault();
      container.scrollBy({ top: -pageOffset, behavior: 'smooth' });
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      container.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  };

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

  const accountCrudBadgeLabel = accountCrudMode === 'read'
    ? 'Read mode'
    : accountCrudMode === 'create'
      ? 'Create mode'
      : 'Update mode';

  const contactCrudBadgeLabel = contactCrudMode === 'read'
    ? 'Read mode'
    : contactCrudMode === 'create'
      ? 'Create mode'
      : 'Update mode';

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
      const { error } = await scopedDb
        .from('v_accounts')
        .delete()
        .eq('id', selectedAccountId);
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
      const { error } = await scopedDb
        .from('v_contacts')
        .delete()
        .eq('id', selectedContactId);
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
      const selectedAccount = accounts.find((item) => item.id === contact.account_id);
      if (selectedAccount) {
        setAccountDraft({
          name: selectedAccount.name || '',
          industry: selectedAccount.industry || '',
          phone: selectedAccount.phone || '',
          website: selectedAccount.website || '',
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
    <div className={cn('lead-workspace-tight-lines grid grid-cols-1 gap-6 xl:grid-cols-12', scrollingEnabled && 'xl:h-[calc(100vh-12.5rem)] xl:overflow-hidden')}>
      <div className={cn('space-y-6 xl:col-span-8', scrollingEnabled && 'xl:grid xl:h-full xl:min-h-0 xl:grid-rows-[minmax(320px,1.2fr)_minmax(280px,1fr)] xl:gap-6 xl:space-y-0 xl:overflow-hidden')}>
        <Card className={cn(scrollingEnabled && 'xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden')}>
          <CardContent
            ref={mainSectionRef}
            className={cn('pt-4', scrollingEnabled && 'xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overscroll-contain xl:scroll-smooth xl:pr-2 xl:scrollbar-thin xl:scrollbar-thumb-gray-300 xl:scrollbar-track-transparent dark:xl:scrollbar-thumb-gray-600 xl:touch-pan-y xl:relative xl:z-10')}
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
            className={cn(scrollingEnabled && 'xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overscroll-contain xl:scroll-smooth xl:pr-2 xl:scrollbar-thin xl:scrollbar-thumb-gray-300 xl:scrollbar-track-transparent dark:xl:scrollbar-thumb-gray-600 xl:touch-pan-y xl:relative xl:z-10')}
            tabIndex={0}
            onScroll={(event) => scheduleScrollPersist('bottom', event.currentTarget.scrollTop)}
            onKeyDown={handleScrollableKeyDown}
            aria-label="Lead details section"
          >
            <Tabs value={bottomTab} onValueChange={(value) => setBottomTab(value as BottomTabKey)}>
              <TabsList className="sticky top-0 z-10 mb-3 w-full justify-start overflow-auto bg-card">
                {enhancementsEnabled ? <TabsTrigger value="account">Account</TabsTrigger> : null}
                {enhancementsEnabled ? <TabsTrigger value="contacts">Contacts</TabsTrigger> : null}
                <TabsTrigger value="internal_notes">{enhancementsEnabled ? 'Internal Notes and Extra Info' : 'Internal Notes'}</TabsTrigger>
                <TabsTrigger value="extra_info">Extra Info</TabsTrigger>
                <TabsTrigger value="ai">AI</TabsTrigger>
                <TabsTrigger value="lead_information">Lead Information</TabsTrigger>
              </TabsList>
              {enhancementsEnabled ? (
                <TabsContent value="account" className="space-y-4">
                  {loadedBottomTabs.has('account') ? (
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
                                  onClick={createAccount}
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
                                  onClick={updateAccount}
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
                                  onClick={deleteAccount}
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
                          <div className="max-h-[220px] overflow-y-auto overscroll-contain p-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent dark:scrollbar-thumb-gray-600" tabIndex={0} onKeyDown={handleScrollableKeyDown}>
                            {accountsLoading ? <p className="text-sm text-muted-foreground p-2">Loading accounts...</p> : null}
                            {!accountsLoading && filteredAccounts.length === 0 ? <p className="text-sm text-muted-foreground p-2">No accounts found</p> : null}
                            {filteredAccounts.map((account) => (
                              <button
                                key={account.id}
                                type="button"
                                onClick={() => void selectAccount(account)}
                                className={cn('w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted', selectedAccountId === account.id && 'bg-primary/10 ring-1 ring-primary/30')}
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
                          <Input value={accountDraft.name} onChange={(e) => setAccountDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Account Name *" />
                          <Input value={accountDraft.industry} onChange={(e) => setAccountDraft((prev) => ({ ...prev, industry: e.target.value }))} placeholder="Industry" />
                          <Input value={accountDraft.phone} onChange={(e) => setAccountDraft((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Phone" />
                          <Input value={accountDraft.website} onChange={(e) => setAccountDraft((prev) => ({ ...prev, website: e.target.value }))} placeholder="Website" />
                        </div>
                      </div>
                    </>
                  ) : null}
                </TabsContent>
              ) : null}
              {enhancementsEnabled ? (
                <TabsContent value="contacts" className="space-y-4">
                  {loadedBottomTabs.has('contacts') ? (
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
                                  onClick={createContact}
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
                                  onClick={updateContact}
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
                                  onClick={deleteContact}
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
                          <div className="max-h-[220px] overflow-y-auto overscroll-contain p-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent dark:scrollbar-thumb-gray-600" tabIndex={0} onKeyDown={handleScrollableKeyDown}>
                            {contactsLoading ? <p className="text-sm text-muted-foreground p-2">Loading contacts...</p> : null}
                            {!contactsLoading && filteredContacts.length === 0 ? <p className="text-sm text-muted-foreground p-2">No contacts found</p> : null}
                            {filteredContacts.map((contact) => (
                              <button
                                key={contact.id}
                                type="button"
                                onClick={() => void selectContact(contact)}
                                className={cn('w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted', selectedContactId === contact.id && 'bg-primary/10 ring-1 ring-primary/30')}
                              >
                                <p className="font-medium">{contact.first_name} {contact.last_name}</p>
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
                          <Input value={contactDraft.first_name} onChange={(e) => setContactDraft((prev) => ({ ...prev, first_name: e.target.value }))} placeholder="First Name *" />
                          <Input value={contactDraft.last_name} onChange={(e) => setContactDraft((prev) => ({ ...prev, last_name: e.target.value }))} placeholder="Last Name *" />
                          <Input value={contactDraft.title} onChange={(e) => setContactDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder="Title" />
                          <Input value={contactDraft.email} onChange={(e) => setContactDraft((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" />
                          <Input value={contactDraft.phone} onChange={(e) => setContactDraft((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Phone" />
                        </div>
                      </div>
                    </>
                  ) : null}
                </TabsContent>
              ) : null}
              <TabsContent value="internal_notes">
                {loadedBottomTabs.has('internal_notes') ? (
                  <div className="space-y-3">
                    {enhancementsEnabled ? (
                      <>
                        {narrativeValidationError ? <p className="text-sm text-destructive">{narrativeValidationError}</p> : null}
                        <div className="rounded-md border p-3">
                          <div className="mb-2 text-sm font-medium">Description</div>
                          <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/20 p-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('description', 'bold')} aria-label="Description Bold"><Bold className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('description', 'italic')} aria-label="Description Italic"><Italic className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('description', 'underline')} aria-label="Description Underline"><Underline className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('description', 'insertUnorderedList')} aria-label="Description Unordered list"><List className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('description', 'insertOrderedList')} aria-label="Description Ordered list"><ListOrdered className="h-4 w-4" /></Button>
                          </div>
                          <div
                            ref={descriptionEditorRef}
                            contentEditable
                            className="mt-2 min-h-[120px] rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            onFocus={() => setBottomTab('internal_notes')}
                            onInput={(event) => setDraftValue('description', sanitizeRichTextHtml((event.target as HTMLDivElement).innerHTML))}
                          />
                          <p className="mt-1 text-xs text-muted-foreground">{stripHtmlTags(bottomDraft.description || '').length}/5000 characters</p>
                        </div>
                      </>
                    ) : null}
                    <Textarea value={bottomDraft.internal_notes} onChange={(e) => setDraftValue('internal_notes', e.target.value)} className="min-h-[140px]" />
                  </div>
                ) : null}
              </TabsContent>
              <TabsContent value="extra_info">
                {loadedBottomTabs.has('extra_info') ? (
                  <div className="space-y-3">
                    {enhancementsEnabled ? (
                      <>
                        {narrativeValidationError ? <p className="text-sm text-destructive">{narrativeValidationError}</p> : null}
                        <div className="rounded-md border p-3">
                          <div className="mb-2 text-sm font-medium">Notes</div>
                          <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/20 p-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('notes', 'bold')} aria-label="Notes Bold"><Bold className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('notes', 'italic')} aria-label="Notes Italic"><Italic className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('notes', 'underline')} aria-label="Notes Underline"><Underline className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('notes', 'insertUnorderedList')} aria-label="Notes Unordered list"><List className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => execRichText('notes', 'insertOrderedList')} aria-label="Notes Ordered list"><ListOrdered className="h-4 w-4" /></Button>
                          </div>
                          <div
                            ref={notesEditorRef}
                            contentEditable
                            className="mt-2 min-h-[120px] rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            onFocus={() => setBottomTab('extra_info')}
                            onInput={(event) => setDraftValue('notes', sanitizeRichTextHtml((event.target as HTMLDivElement).innerHTML))}
                          />
                          <p className="mt-1 text-xs text-muted-foreground">{stripHtmlTags(bottomDraft.notes || '').length}/10000 characters</p>
                        </div>
                      </>
                    ) : null}
                    <Textarea value={bottomDraft.extra_info} onChange={(e) => setDraftValue('extra_info', e.target.value)} className="min-h-[140px]" />
                  </div>
                ) : null}
              </TabsContent>
              <TabsContent value="ai">
                {loadedBottomTabs.has('ai') ? (
                  <Textarea value={bottomDraft.ai} onChange={(e) => setDraftValue('ai', e.target.value)} className="min-h-[140px]" />
                ) : null}
              </TabsContent>
              <TabsContent value="lead_information">
                {loadedBottomTabs.has('lead_information') ? (
                  <Textarea value={bottomDraft.lead_information} onChange={(e) => setDraftValue('lead_information', e.target.value)} className="min-h-[140px]" />
                ) : null}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className={cn('xl:col-span-4', scrollingEnabled && 'xl:h-full xl:min-h-0 xl:overflow-hidden')}>
        <Card className={cn(scrollingEnabled && 'xl:flex xl:min-h-0 xl:flex-col')}>
          <CardHeader className={cn(scrollingEnabled && 'xl:sticky xl:top-0 xl:z-10 xl:border-b xl:bg-card')}>
            <CardTitle>Communication</CardTitle>
          </CardHeader>
          <CardContent
            ref={communicationSectionRef}
            className={cn(scrollingEnabled && 'xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:scroll-smooth xl:pr-2 xl:scrollbar-thin xl:scrollbar-thumb-gray-300 xl:scrollbar-track-transparent dark:xl:scrollbar-thumb-gray-600 xl:touch-pan-y')}
            tabIndex={0}
            onScroll={(event) => scheduleScrollPersist('communication', event.currentTarget.scrollTop)}
            onKeyDown={handleScrollableKeyDown}
            aria-label="Communication section"
          >
            <Tabs value={communicationTab} onValueChange={(value) => setCommunicationTab(value as CommunicationTabKey)} orientation="vertical" className="flex flex-col items-start justify-start gap-4 md:flex-row">
              <TabsList className="flex h-auto w-full flex-row flex-wrap items-start justify-start gap-1 self-start md:w-[180px] md:flex-col md:flex-nowrap">
                <TabsTrigger value="send_message" className="min-h-11 justify-start px-3 text-left">Send Message</TabsTrigger>
                <TabsTrigger value="notes" className="min-h-11 justify-start px-3 text-left">Notes</TabsTrigger>
                <TabsTrigger value="lead_activities" className="min-h-11 justify-start px-3 text-left">Lead Activities</TabsTrigger>
              </TabsList>
              <div className="flex-1 self-start">
                <TabsContent value="send_message" className="mt-0 space-y-3">
                  {loadedCommunicationTabs.has('send_message') ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate('follow_up')}>Follow-up</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate('meeting')}>Meeting</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate('proposal')}>Proposal</Button>
                      </div>
                      <Input value={composerSubject} onChange={(e) => setComposerSubject(e.target.value)} placeholder="Subject" />
                      <Textarea value={composerBody} onChange={(e) => setComposerBody(e.target.value)} className="min-h-[140px]" placeholder="Write message..." />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button type="button" size="icon" onClick={sendMessage} aria-label="Send message" title="Send Message">
                              <Send className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Send Message</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </>
                  ) : null}
                </TabsContent>
                <TabsContent value="notes" className="mt-0 space-y-3">
                  {loadedCommunicationTabs.has('notes') ? (
                    <>
                      <div className="space-y-2">
                        {notes.map((note) => (
                          <div key={note.id} className="rounded-md border p-2">
                            {editingNoteId === note.id ? (
                              <div className="space-y-2">
                                <Textarea value={editingNoteValue} onChange={(e) => setEditingNoteValue(e.target.value)} className="min-h-[88px]" />
                                <div className="flex gap-2">
                                  <Button type="button" size="sm" onClick={updateNote}>Save</Button>
                                  <Button type="button" size="sm" variant="outline" onClick={() => setEditingNoteId(null)}>Cancel</Button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-sm whitespace-pre-wrap">{note.description}</p>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleString()}</span>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8 text-blue-600 hover:text-blue-700"
                                          onClick={() => {
                                            setEditingNoteId(note.id);
                                            setEditingNoteValue(note.description);
                                          }}
                                          aria-label="Edit note"
                                          title="Edit"
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Edit</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <Textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} className="min-h-[90px]" placeholder="Add note..." />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="icon"
                              className="bg-emerald-600 text-white hover:bg-emerald-700"
                              onClick={saveNote}
                              aria-label="Add note"
                              title="Add Note"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Add Note</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </>
                  ) : null}
                </TabsContent>
                <TabsContent value="lead_activities" className="mt-0 space-y-3">
                  {loadedCommunicationTabs.has('lead_activities') ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => eventBus.emit('activities:filter', { type: 'call' })}>Call</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => eventBus.emit('activities:filter', { type: 'email' })}>Email</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => eventBus.emit('activities:filter', { type: 'meeting' })}>Meeting</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => eventBus.emit('activities:filter', { type: 'all' })}>All</Button>
                      </div>
                      {leadId ? <LeadActivitiesTimeline leadId={leadId} eventBus={eventBus} /> : <p className="text-sm text-muted-foreground">Save lead first to view timeline</p>}
                    </>
                  ) : null}
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
