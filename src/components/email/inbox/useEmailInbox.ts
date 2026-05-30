import { useState, useEffect, useRef } from 'react';

import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { invokeFunction } from '@/lib/supabase-functions';
import { useLeadDuplicateCheck } from '@/hooks/useLeadDuplicateCheck';
import { cleanEmail } from '@/lib/data-cleaning';
import { logger } from '@/lib/logger';

import type {
  DuplicateMap,
  Email,
  EmailAccount,
  SortDirection,
  SortField,
  ThreadGroup,
} from './types';

interface UseEmailInboxResult {
  emails: Email[];
  threads: ThreadGroup[];
  accounts: EmailAccount[];
  loading: boolean;
  syncing: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedFolder: string;
  setSelectedFolder: (f: string) => void;
  selectedAccountId: string;
  setSelectedAccountId: (id: string) => void;
  sortField: SortField;
  setSortField: (f: SortField) => void;
  sortDirection: SortDirection;
  setSortDirection: (d: SortDirection) => void;
  conversationView: boolean;
  setConversationView: (v: boolean) => void;
  duplicateMap: DuplicateMap;
  fetchEmails: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  toggleStar: (id: string, isStarred: boolean) => Promise<void>;
  moveToFolder: (id: string, folder: string) => Promise<void>;
  syncEmails: (opts?: { silent?: boolean }) => Promise<void>;
  syncAllMailboxes: () => Promise<void>;
  updateEmailPriority: (id: string, priority: string) => Promise<void>;
  scanEmail: (id: string) => Promise<void>;
  processEmail: (id: string) => Promise<void>;
}

export function useEmailInbox(): UseEmailInboxResult {
  const [emails, setEmails] = useState<Email[]>([]);
  const [threads, setThreads] = useState<ThreadGroup[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('received_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [conversationView, setConversationView] = useState(false);
  const [duplicateMap, setDuplicateMap] = useState<DuplicateMap>({});
  const { toast } = useToast();
  const { roles } = useAuth();
  const { buildEmailDuplicateMap } = useLeadDuplicateCheck();
  const autoSyncedRef = useRef<Record<string, boolean>>({});

  const getTenantId = (): string | null => {
    const tenantAdmin = roles.find((r) => r.role === 'tenant_admin' && r.tenant_id);
    return tenantAdmin?.tenant_id || roles.find((r) => r.tenant_id)?.tenant_id || null;
  };

  const fetchEmails = async (): Promise<void> => {
    try {
      setLoading(true);
      const looksLikeEmail = /@/.test(searchQuery.trim());
      const tenantId = getTenantId();

      if (conversationView) {
        const { data, error } = await invokeFunction('search-emails', {
          body: {
            tenantId,
            accountId: selectedAccountId || undefined,
            folder: selectedFolder,
            groupBy: 'conversation',
            page: 1,
            pageSize: 50,
            sortGroupBy: 'date',
            sortDirection,
          },
        });
        if (error) throw error as any;
        setThreads(((data?.data as ThreadGroup[]) || []));
        setEmails([]);
        return;
      }

      if (searchQuery && looksLikeEmail) {
        const direction =
          selectedFolder === 'inbox' ? 'inbound' : selectedFolder === 'sent' ? 'outbound' : undefined;
        const { data, error } = await invokeFunction('search-emails', {
          body: {
            email: searchQuery.trim(),
            tenantId,
            accountId: selectedAccountId || undefined,
            direction,
            page: 1,
            pageSize: 50,
          },
        });
        if (error) throw error as any;
        const results = (data?.data as Email[]) || [];
        const sorted = [...results].sort((a, b) => {
          const dir = sortDirection === 'asc' ? 1 : -1;
          if (sortField === 'received_at') {
            return (new Date(a.received_at).getTime() - new Date(b.received_at).getTime()) * dir;
          }
          const av = (a[sortField] || '').toString().toLowerCase();
          const bv = (b[sortField] || '').toString().toLowerCase();
          return av.localeCompare(bv) * dir;
        });
        setEmails(sorted);
        return;
      }

      let query = (supabase as any)
        .from('emails')
        .select('*')
        .eq('folder', selectedFolder)
        .order(sortField, { ascending: sortDirection === 'asc' })
        .limit(50);

      if (selectedAccountId && selectedAccountId !== '') {
        query = query.eq('account_id', selectedAccountId);
      }
      if (searchQuery) {
        query = query.or(
          `subject.ilike.%${searchQuery}%,from_email.ilike.%${searchQuery}%,snippet.ilike.%${searchQuery}%`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      setEmails(data || []);
    } catch (error: any) {
      if (error.message?.includes('non-2xx') && (error as any)?.context?.status === 401) {
        logger.error('Fetch Emails Unauthorized. Full error:', error);
        toast({
          title: 'Session Expired',
          description: 'Please log out and log in again to view emails.',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Error fetching emails', description: error.message, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async (): Promise<void> => {
    try {
      const { data, error } = await (supabase as any)
        .from('email_accounts')
        .select('id, email_address, provider, is_primary')
        .eq('is_active', true)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAccounts(data || []);
      if (data && data.length > 0) {
        const primary = data.find((a: EmailAccount) => a.is_primary);
        setSelectedAccountId((primary || data[0]).id);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const markAsRead = async (emailId: string): Promise<void> => {
    try {
      const { error } = await (supabase as any).from('emails').update({ is_read: true }).eq('id', emailId);
      if (error) throw error;
      fetchEmails();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const toggleStar = async (emailId: string, isStarred: boolean): Promise<void> => {
    try {
      const { error } = await (supabase as any)
        .from('emails')
        .update({ is_starred: !isStarred })
        .eq('id', emailId);
      if (error) throw error;
      fetchEmails();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const moveToFolder = async (emailId: string, folder: string): Promise<void> => {
    try {
      const { error } = await (supabase as any).from('emails').update({ folder }).eq('id', emailId);
      if (error) throw error;
      toast({ title: 'Success', description: `Email moved to ${folder}` });
      fetchEmails();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const syncEmails = async (options?: { silent?: boolean }): Promise<void> => {
    try {
      setSyncing(true);
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      if (!authData.user?.id) throw new Error('Not authenticated');
      if (!selectedAccountId || selectedAccountId === '') {
        toast({
          title: 'Select a mailbox',
          description: 'Please choose a mailbox from the selector before syncing.',
          variant: 'destructive',
        });
        return;
      }
      const { data, error } = await invokeFunction('sync-emails-v2', {
        body: { accountId: selectedAccountId },
      });
      if (error) throw error as any;
      if (!options?.silent) {
        toast({ title: 'Synced', description: data?.message || 'Email sync complete.' });
      }
      await fetchEmails();
    } catch (error: any) {
      if (!options?.silent) {
        const rawMessage = error?.message as string | undefined;
        let message = rawMessage || 'Email sync failed';
        if (rawMessage?.includes('non-2xx') && (error as any)?.context?.status === 401) {
          logger.error('Sync Unauthorized after retry. Full error:', error);
          toast({
            title: 'Sync Unauthorized',
            description: 'Session expired. Please log out and log in again.',
            variant: 'destructive',
          });
          return;
        }
        if (rawMessage?.includes('Failed to fetch')) {
          message = 'Could not reach Supabase Edge Functions. Check network connection and project configuration.';
        }
        toast({ title: 'Sync failed', description: message, variant: 'destructive' });
      }
    } finally {
      setSyncing(false);
    }
  };

  const syncAllMailboxes = async (): Promise<void> => {
    try {
      setSyncing(true);
      const tenantId = getTenantId();
      if (tenantId) {
        const { data, error } = await invokeFunction('sync-all-mailboxes', {
          body: { tenantId, limit: 100 },
        });
        if (error) throw error as any;
        toast({ title: 'Sync triggered', description: `Processed ${data?.accountsProcessed || 0} accounts` });
        await fetchEmails();
        return;
      }
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      if (!authData.user?.id) throw new Error('Not authenticated');
      const { data: userAccounts, error: accErr } = await (supabase as any)
        .from('email_accounts')
        .select('id')
        .eq('user_id', authData.user.id)
        .eq('is_active', true);
      if (accErr) throw accErr;
      if (!userAccounts || userAccounts.length === 0) {
        toast({ title: 'No accounts', description: 'Add an email account first.', variant: 'destructive' });
        return;
      }
      let totalSynced = 0;
      for (const acc of userAccounts) {
        const { data, error } = await invokeFunction('sync-emails-v2', { body: { accountId: acc.id } });
        if (error) {
          logger.error('Sync error for account', acc.id, error);
          continue;
        }
        totalSynced += data?.syncedCount || 0;
      }
      toast({
        title: 'Sync complete',
        description: `Processed ${userAccounts.length} accounts. Total emails: ${totalSynced}`,
      });
      await fetchEmails();
    } catch (error: any) {
      toast({ title: 'Sync all failed', description: error.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const updateEmailPriority = async (emailId: string, priority: string): Promise<void> => {
    try {
      const { error } = await (supabase as any).from('emails').update({ priority }).eq('id', emailId);
      if (error) throw error;
      setEmails((prev) => prev.map((e) => (e.id === emailId ? { ...e, priority } : e)));
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const scanEmail = async (emailId: string): Promise<void> => {
    try {
      toast({ title: 'Scanning email...', description: 'Please wait while we check for threats.' });
      setEmails((prev) => prev.map((e) => (e.id === emailId ? { ...e, security_status: 'scanning' } : e)));
      const { data, error } = await invokeFunction('email-scan', { body: { email_id: emailId } });
      if (error) throw error;
      toast({
        title: 'Scan Complete',
        description: `Status: ${data?.scan_result?.security_status || 'Unknown'}`,
        variant: data?.scan_result?.security_status === 'clean' ? 'default' : 'destructive',
      });
      fetchEmails();
    } catch (error: any) {
      toast({ title: 'Scan Failed', description: error.message, variant: 'destructive' });
      fetchEmails();
    }
  };

  const heuristicClassify = async (emailId: string): Promise<void> => {
    const { data: emailRow } = await (supabase as any)
      .from('emails')
      .select('subject, body_text, snippet')
      .eq('id', emailId)
      .maybeSingle();
    const subject = String(emailRow?.subject || '');
    const body = String(emailRow?.body_text || emailRow?.snippet || '');
    const text = `${subject}\n${body}`.toLowerCase();
    const positive = /(great|thanks|appreciate|love|excellent|good job)/.test(text);
    const negative = /(angry|worst|terrible|issue|error|problem|complaint|disappointed)/.test(text);
    const urgencyHigh = /(urgent|asap|immediately|priority)/.test(text);
    const sentiment = positive ? 'positive' : negative ? 'negative' : 'neutral';
    const intent = /(quote|pricing|cost|price)/.test(text)
      ? 'sales'
      : /(help|support|bug|issue|error|problem|trouble)/.test(text)
      ? 'support'
      : /(invoice|payment|billing|refund)/.test(text)
      ? 'billing'
      : /(schedule|meeting|appointment)/.test(text)
      ? 'scheduling'
      : /(complaint|escalate|escalation)/.test(text)
      ? 'complaint'
      : 'general';
    const category = /(compliance|documentation)/.test(text)
      ? 'compliance'
      : intent === 'sales'
      ? 'sales'
      : intent === 'support'
      ? 'support'
      : 'crm';
    const ai_urgency = urgencyHigh ? 'high' : 'medium';
    await (supabase as any)
      .from('emails')
      .update({ ai_sentiment: sentiment, intent, category, ai_urgency })
      .eq('id', emailId);
  };

  const processEmail = async (emailId: string): Promise<void> => {
    try {
      toast({ title: 'Processing email...', description: 'Running classification and security scan.' });
      const { error: classifyError } = await invokeFunction('classify-email', { body: { email_id: emailId } });
      if (classifyError) {
        const msg = String((classifyError as any)?.message || '');
        const isJwtIssue = /invalid jwt|unauthorized|401/i.test(msg);
        if (isJwtIssue) {
          await supabase.auth.refreshSession();
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          if (!token) throw classifyError as any;
          const anonKey =
            (import.meta.env as any).VITE_SUPABASE_PUBLISHABLE_KEY ||
            (import.meta.env as any).VITE_SUPABASE_ANON_KEY ||
            '';
          const { error: retryErr } = await supabase.functions.invoke('classify-email', {
            body: { email_id: emailId },
            headers: { apikey: anonKey },
          });
          if (retryErr) await heuristicClassify(emailId);
        } else {
          await heuristicClassify(emailId);
        }
      }
      const { error: scanError } = await invokeFunction('email-scan', { body: { email_id: emailId } });
      if (scanError) throw scanError as any;
      toast({ title: 'Processed', description: 'Classification and security scan complete.' });
      fetchEmails();
    } catch (error: any) {
      toast({ title: 'Process failed', description: error.message, variant: 'destructive' });
      fetchEmails();
    }
  };

  // ── Side effects ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (
      selectedAccountId &&
      selectedAccountId !== '' &&
      !autoSyncedRef.current[selectedAccountId]
    ) {
      autoSyncedRef.current[selectedAccountId] = true;
      syncEmails({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId]);

  useEffect(() => {
    fetchEmails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolder, searchQuery, selectedAccountId, sortField, sortDirection, conversationView]);

  useEffect(() => {
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function computeDuplicates(): Promise<void> {
      try {
        const list = conversationView
          ? threads.map((t) => t.latestEmail?.from_email).filter(Boolean)
          : emails.map((e) => e.from_email).filter(Boolean);
        const map = await buildEmailDuplicateMap(list as string[]);
        setDuplicateMap(map);
      } catch {
        setDuplicateMap({});
      }
    }
    if (!loading) computeDuplicates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, emails, threads, conversationView]);

  return {
    emails,
    threads,
    accounts,
    loading,
    syncing,
    searchQuery,
    setSearchQuery,
    selectedFolder,
    setSelectedFolder,
    selectedAccountId,
    setSelectedAccountId,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    conversationView,
    setConversationView,
    duplicateMap,
    fetchEmails,
    markAsRead,
    toggleStar,
    moveToFolder,
    syncEmails,
    syncAllMailboxes,
    updateEmailPriority,
    scanEmail,
    processEmail,
  };
}

// Helper exported for row components that need to look up duplicates by from_email.
export function lookupDuplicate(map: DuplicateMap, fromEmail: string): { count: number } | undefined {
  const key = cleanEmail(fromEmail).value || fromEmail?.trim().toLowerCase();
  return key ? map[key] : undefined;
}
