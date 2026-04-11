import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LeadForm } from '@/components/crm/LeadForm';
import type { LeadFormData } from '@/components/crm/LeadForm';
import { LeadWorkspaceSections } from '@/components/crm/LeadWorkspaceSections';
import type { Json } from '@/integrations/supabase/types';
import { LeadConversionDialog } from '@/components/crm/conversion/LeadConversionDialog';
import { LeadActivitiesTimeline } from '@/components/crm/LeadActivitiesTimeline';
import { EmailClient } from "@/components/email/EmailClient";
import { EmailComposeDialog } from "@/components/email/EmailComposeDialog";
import { LeadScoringCard } from '@/components/crm/LeadScoringCard';
import { ManualAssignment } from '@/components/assignment/ManualAssignment';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, Edit, Trash2, UserPlus, DollarSign, Calendar, Mail, Phone, Building2, GitBranch, Users as UsersIcon, PanelLeftClose, PanelLeftOpen, Bold, Italic, Underline, List, ListOrdered, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Lead, statusConfig } from './leads-data';
import { exportCsv, exportExcel } from '@/lib/import-export';
import { getScoreGrade } from '@/utils/leadScoring';
import { DetailScreenTemplate } from '@/components/system/DetailScreenTemplate';
import { CRM_HEADER_PRIMARY_CONTROL_SEQUENCE, CRMModuleHeaderNavigation } from '@/components/crm/CRMModuleHeaderNavigation';
import { themeStyleFromPreset } from '@/lib/theme-utils';
import { useLeadsViewState, LeadsPrimaryView } from '@/hooks/useLeadsViewState';
import { useStickyActions } from '@/components/layout/StickyActionsContext';
import { FEATURE_FLAGS, useAppFeatureFlag } from '@/lib/feature-flags';
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/react';
import { classifyFetchFailure, DEFAULT_RETRY_POLICY, describeFetchFailure, runWithRetry } from '@/lib/fetch-resilience';
import { sanitizeRichTextHtml, stripHtmlTags } from '@/lib/utils/sanitizer';

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { supabase, scopedDb, context } = useCRM();
  const { state: viewState, setTheme, setView, setPipeline } = useLeadsViewState();
  const currentTheme = viewState.theme;
  const threeSectionLeadWorkspace = useAppFeatureFlag(FEATURE_FLAGS.LEAD_THREE_SECTION_LAYOUT);
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showConversionDialog, setShowConversionDialog] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState<{ subject: string; body: string; activityId?: string } | null>(null);
  const [interactionStats, setInteractionStats] = useState<{ total: number; calls: number; emails: number; meetings: number; tasks: number; notes: number; automated: number } | null>(null);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [accountDetails, setAccountDetails] = useState<any>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const accountCacheRef = useRef<Record<string, any>>({});
  const [tabValue, setTabValue] = useState<'activity' | 'email'>(() => {
    return location.hash === '#email' ? 'email' : 'activity';
  });
  const [infoTab, setInfoTab] = useState<'description' | 'notes'>('description');
  const [infoCollapsed, setInfoCollapsed] = useState(false);
  const [descriptionHtml, setDescriptionHtml] = useState('');
  const [notesHtml, setNotesHtml] = useState('');
  const [descriptionDirty, setDescriptionDirty] = useState(false);
  const [notesDirty, setNotesDirty] = useState(false);
  const [isDescriptionSaving, setIsDescriptionSaving] = useState(false);
  const [isNotesSaving, setIsNotesSaving] = useState(false);
  const [descriptionSaveError, setDescriptionSaveError] = useState<string | null>(null);
  const [notesSaveError, setNotesSaveError] = useState<string | null>(null);
  const [lastInfoSavedAt, setLastInfoSavedAt] = useState<string | null>(null);
  const descriptionEditorRef = useRef<HTMLDivElement | null>(null);
  const notesEditorRef = useRef<HTMLDivElement | null>(null);
  const descriptionAutoSaveRef = useRef<number | null>(null);
  const notesAutoSaveRef = useRef<number | null>(null);
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
  const shouldOpenInEditMode = Boolean((location.state as { openEdit?: boolean } | null)?.openEdit);
  const shouldAutoSaveInEditMode = Boolean((location.state as { autoSave?: boolean } | null)?.autoSave);
  const leadSnapshot = (location.state as { leadSnapshot?: Lead } | null)?.leadSnapshot;

  const handleThemeChange = useCallback((val: string) => {
    setTheme(val);
    try {
      localStorage.setItem('leadsTheme', val);
    } catch {
      return;
    }
  }, [setTheme]);

  const handleHeaderViewModeChange = useCallback((mode: LeadsPrimaryView) => {
    if (mode === 'pipeline') {
      try {
        localStorage.setItem('leadsViewMode', 'pipeline');
      } catch {
        void 0;
      }
      scopedDb.logViewPreference('leads', 'pipeline');
      setView('pipeline');
      setPipeline({ q: '', status: [], tab: 'board' });
      navigate('/dashboard/leads/pipeline');
      return;
    }

    try {
      localStorage.setItem('leadsViewMode', mode);
    } catch {
      void 0;
    }
    scopedDb.logViewPreference('leads', mode);
    setView(mode);
    navigate('/dashboard/leads');
  }, [navigate, scopedDb, setPipeline, setView]);

  const getCrmApiHeaders = useCallback(async () => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token || '';
    const tenantId = context.tenantId || '';
    return {
      'Content-Type': 'application/json',
      ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      ...(context.franchiseId ? { 'x-franchise-id': context.franchiseId } : {}),
      ...(context.userId ? { 'x-user-id': context.userId } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [context.franchiseId, context.tenantId, context.userId, supabase.auth]);

  useEffect(() => {
    if (location.state && (location.state as any).openComposer) {
      const state = location.state as any;
      setComposeData({
        subject: state.initialSubject || '',
        body: state.initialBody || '',
        activityId: state.activityId
      });
      setComposeOpen(true);
      
      // Clear state without triggering re-navigation
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    setTabValue(location.hash === '#email' ? 'email' : 'activity');
  }, [location.hash]);

  useEffect(() => {
    if (shouldOpenInEditMode) {
      setIsEditing(true);
    }
  }, [shouldOpenInEditMode]);

  useEffect(() => {
    if (!leadSnapshot || !id || leadSnapshot.id !== id) return;
    setLead((prev) => prev ?? leadSnapshot);
    setLoading((prev) => (prev ? false : prev));
  }, [id, leadSnapshot]);

  const handleTabChange = (value: string) => {
    const next = value === 'email' ? 'email' : 'activity';
    setTabValue(next);
    const basePath = `/dashboard/leads/${id}`;
    const hash = next === 'email' ? '#email' : '';
    navigate(`${basePath}${hash}`, { replace: true });
  };

  const fetchLead = useCallback(async () => {
    try {
      const headers = await getCrmApiHeaders();
      const response = await fetch(`/api/crm/v1/leads/${encodeURIComponent(String(id || ''))}`, {
        method: 'GET',
        credentials: 'include',
        headers,
      });
      if (response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload?.data) {
          setLead(payload.data as Lead);
          return;
        }
      }

      const { data, error } = await scopedDb
        .from('leads')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setLead(data as unknown as Lead);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to load lead', { description: message });
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [getCrmApiHeaders, id, scopedDb]);

  const upsertLeadDescription = useCallback(async (nextDescription: string) => {
    if (!id || !context.tenantId) return;
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const response = await fetch(`/api/leads/${encodeURIComponent(id)}/description`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': context.tenantId,
        ...(context.userId ? { 'x-user-id': context.userId } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ description: nextDescription }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Failed to save description');
    }
    const cleanDescription = sanitizeRichTextHtml(String(payload?.data?.description || ''));
    setDescriptionHtml(cleanDescription);
    setLead(prev => prev ? { ...prev, description: cleanDescription } : prev);
    setLastInfoSavedAt(payload?.data?.updatedAt || new Date().toISOString());
  }, [context.tenantId, context.userId, id, supabase.auth]);

  const upsertLeadNotes = useCallback(async (nextNotes: string) => {
    if (!id || !context.tenantId) return;
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const response = await fetch(`/api/leads/${encodeURIComponent(id)}/notes`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': context.tenantId,
        ...(context.userId ? { 'x-user-id': context.userId } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ notes: nextNotes }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Failed to save notes');
    }
    const cleanNotes = sanitizeRichTextHtml(String(payload?.data?.notes || ''));
    setNotesHtml(cleanNotes);
    setLead(prev => prev ? { ...prev, notes: cleanNotes } : prev);
    setLastInfoSavedAt(payload?.data?.updatedAt || new Date().toISOString());
  }, [context.tenantId, context.userId, id, supabase.auth]);

  const fetchDescriptionNotes = useCallback(async () => {
    if (!id || !context.tenantId) return;
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const response = await fetch(`/api/leads/${encodeURIComponent(id)}/description-notes`, {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': context.tenantId,
          ...(context.userId ? { 'x-user-id': context.userId } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load description and notes');
      }
      const cleanDescription = sanitizeRichTextHtml(String(payload?.data?.description || ''));
      const cleanNotes = sanitizeRichTextHtml(String(payload?.data?.notes || ''));
      setDescriptionHtml(cleanDescription);
      setNotesHtml(cleanNotes);
      setLastInfoSavedAt(payload?.data?.updatedAt || null);
      setDescriptionDirty(false);
      setNotesDirty(false);
      setLead(prev => prev ? { ...prev, description: cleanDescription, notes: cleanNotes } : prev);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load description and notes';
      toast.error('Failed to load description and notes', { description: message });
    }
  }, [context.tenantId, context.userId, id, supabase.auth]);

  useEffect(() => {
    if (id) {
      fetchLead();
      fetchDescriptionNotes();

      // Real-time subscription for lead updates (e.g. score changes)
      const channel = supabase
        .channel(`lead-detail-${id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'leads',
            filter: `id=eq.${id}`
          },
          (payload) => {
            setLead(payload.new as unknown as Lead);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [id, fetchDescriptionNotes, fetchLead, supabase]);

  useEffect(() => {
    if (descriptionEditorRef.current && descriptionEditorRef.current.innerHTML !== descriptionHtml) {
      descriptionEditorRef.current.innerHTML = descriptionHtml;
    }
  }, [descriptionHtml]);

  useEffect(() => {
    if (notesEditorRef.current && notesEditorRef.current.innerHTML !== notesHtml) {
      notesEditorRef.current.innerHTML = notesHtml;
    }
  }, [notesHtml]);

  useEffect(() => {
    if (!descriptionDirty) return;
    if (descriptionAutoSaveRef.current) {
      window.clearTimeout(descriptionAutoSaveRef.current);
    }
    descriptionAutoSaveRef.current = window.setTimeout(async () => {
      try {
        setIsDescriptionSaving(true);
        setDescriptionSaveError(null);
        await upsertLeadDescription(descriptionHtml);
        setDescriptionDirty(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Auto-save failed';
        setDescriptionSaveError(message);
      } finally {
        setIsDescriptionSaving(false);
      }
    }, 30000);
    return () => {
      if (descriptionAutoSaveRef.current) {
        window.clearTimeout(descriptionAutoSaveRef.current);
      }
    };
  }, [descriptionDirty, descriptionHtml, upsertLeadDescription]);

  useEffect(() => {
    if (!notesDirty) return;
    if (notesAutoSaveRef.current) {
      window.clearTimeout(notesAutoSaveRef.current);
    }
    notesAutoSaveRef.current = window.setTimeout(async () => {
      try {
        setIsNotesSaving(true);
        setNotesSaveError(null);
        await upsertLeadNotes(notesHtml);
        setNotesDirty(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Auto-save failed';
        setNotesSaveError(message);
      } finally {
        setIsNotesSaving(false);
      }
    }, 30000);
    return () => {
      if (notesAutoSaveRef.current) {
        window.clearTimeout(notesAutoSaveRef.current);
      }
    };
  }, [notesDirty, notesHtml, upsertLeadNotes]);

  const execInfoCommand = (target: 'description' | 'notes', command: 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList') => {
    const editor = target === 'description' ? descriptionEditorRef.current : notesEditorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command);
    const nextValue = sanitizeRichTextHtml(editor.innerHTML);
    if (target === 'description') {
      setDescriptionHtml(nextValue);
      setDescriptionDirty(true);
    } else {
      setNotesHtml(nextValue);
      setNotesDirty(true);
    }
  };

  const fetchInteractionStats = useCallback(async () => {
    if (!id) return;
    try {
      const [{ data: manual, error: manualError }, { data: automated, error: automatedError }] = await Promise.all([
        supabase.from('activities').select('activity_type').eq('lead_id', id),
        supabase.from('lead_activities' as any).select('type').eq('lead_id', id),
      ]);

      if (manualError) throw manualError;
      if (automatedError) throw automatedError;

      const manualTypes = (manual || []).map((a: any) => String(a.activity_type || '').toLowerCase());
      const automatedCount = (automated || []).length;

      const calls = manualTypes.filter((t) => t === 'call').length;
      const emails = manualTypes.filter((t) => t === 'email').length;
      const meetings = manualTypes.filter((t) => t === 'meeting').length;
      const tasks = manualTypes.filter((t) => t === 'task').length;
      const notes = manualTypes.filter((t) => t === 'note').length;
      const total = manualTypes.length + automatedCount;

      setInteractionStats({ total, calls, emails, meetings, tasks, notes, automated: automatedCount });
    } catch {
      setInteractionStats(null);
    }
  }, [id, supabase]);

  useEffect(() => {
    if (!id) return;
    fetchInteractionStats();
    const channel = supabase
      .channel(`lead-detail-stats-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities', filter: `lead_id=eq.${id}` }, () => fetchInteractionStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_activities', filter: `lead_id=eq.${id}` }, () => fetchInteractionStats())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInteractionStats, id, supabase]);

  const fetchLinkedAccount = useCallback(async () => {
    const customFields = (lead as any)?.custom_fields && typeof (lead as any)?.custom_fields === 'object'
      ? (lead as any).custom_fields as Record<string, unknown>
      : null;
    const accountId =
      (lead as any)?.converted_account_id ||
      (lead as any)?.account_id ||
      (typeof customFields?.converted_account_id === 'string' ? customFields.converted_account_id : null) ||
      (typeof customFields?.account_id === 'string' ? customFields.account_id : null);
    if (!accountId) {
      setAccountDetails(null);
      setAccountError(null);
      return;
    }
    try {
      setAccountLoading(true);
      setAccountError(null);
      const data = await runWithRetry(
        async () => {
          const { data: accountData, error } = await scopedDb
            .from('accounts')
            .select('id, name, industry, phone, website, annual_revenue')
            .eq('id', accountId)
            .maybeSingle();
          if (error) throw error;
          if (!accountData) return null;
          return {
            ...accountData,
            primary_contact_name: null,
          };
        },
        DEFAULT_RETRY_POLICY,
        (attempt, meta) => {
          logger.warn('Retrying account details fetch', {
            component: 'LeadDetail',
            leadId: id,
            accountId,
            attempt,
            reason: meta.kind,
            statusCode: meta.statusCode,
          });
        },
      );

      if (!data) {
        setAccountDetails(null);
        setAccountError('Linked account could not be found or is not accessible with current permissions.');
        return;
      }
      accountCacheRef.current[accountId] = data;
      setAccountDetails(data);
    } catch (error: unknown) {
      const meta = classifyFetchFailure(error);
      logger.error('Failed to load account details for lead', {
        component: 'LeadDetail',
        leadId: id,
        accountId,
        reason: meta.kind,
        statusCode: meta.statusCode,
        error: meta.message,
      });
      Sentry.captureException(error);
      const cached = accountCacheRef.current[accountId];
      if (cached) {
        setAccountDetails(cached);
        setAccountError('Showing cached account details while connection recovers.');
        toast.warning('Showing cached account details', { description: describeFetchFailure(meta) });
      } else {
        let message = describeFetchFailure(meta);
        if (meta.kind === 'auth') {
          const session = await supabase.auth?.getSession?.();
          if (!session?.data?.session) {
            message = 'Authentication expired. Please sign in again.';
          }
        }
        setAccountDetails(null);
        setAccountError(message);
        toast.error('Failed to load account details', { description: message });
      }
    } finally {
      setAccountLoading(false);
    }
  }, [id, lead, scopedDb, supabase.auth]);

  useEffect(() => {
    fetchLinkedAccount();
  }, [fetchLinkedAccount]);

  const updateLead = async (formData: LeadFormData, options?: { keepEditing?: boolean; silent?: boolean }) => {
    try {
      // Extract extras and merge into custom_fields
      const { service_id, attachments, lead_type, referral_name, decision_timeline, stakeholders_count, lost_reason, ...rest } = formData || ({} as LeadFormData);
      const payload: any = { ...rest };
      payload.expected_close_date = rest.expected_close_date ? rest.expected_close_date : null;
      if (payload.franchise_id === '') payload.franchise_id = null;
      if (payload.tenant_id === '') delete payload.tenant_id;
      const attachmentList = Array.isArray(attachments) ? attachments : [];
      const attachmentNames = attachmentList
        .map((f) => {
          if (f && typeof f === 'object' && 'name' in f) {
            const name = (f as { name?: unknown }).name;
            if (typeof name === 'string') return name;
          }
          return undefined;
        })
        .filter((n): n is string => !!n);
      const mergedCustomFields: Json = {
        ...(lead?.custom_fields || {}),
        ...(service_id ? { service_id } : {}),
        ...(lead_type ? { lead_type } : {}),
        ...(referral_name ? { referral_name } : {}),
        ...(decision_timeline ? { decision_timeline } : {}),
        ...(stakeholders_count ? { stakeholders_count } : {}),
        ...(lost_reason ? { lost_reason } : {}),
        ...(attachmentNames.length ? { attachments_names: attachmentNames } : {}),
      };

      const updatePayload = {
        ...payload,
        estimated_value: formData.estimated_value ? parseFloat(formData.estimated_value) : null,
        custom_fields: Object.keys(mergedCustomFields as Record<string, unknown>).length ? mergedCustomFields : null,
      };

      const headers = await getCrmApiHeaders();
      const response = await fetch(`/api/crm/v1/leads/${encodeURIComponent(String(id || ''))}`, {
        method: 'PATCH',
        credentials: 'include',
        headers,
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const { error } = await scopedDb
          .from('leads')
          .update(updatePayload)
          .eq('id', id);
        if (error) throw error;
      }

      if (!options?.silent) {
        toast.success('Lead updated successfully');
      }
      if (returnTo && !options?.keepEditing) {
        toast.success('Returning to Leads List');
        navigate(returnTo, { replace: true });
        return;
      }
      if (!options?.keepEditing) {
        setIsEditing(false);
      }
      fetchLead();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (!options?.silent) {
        toast.error('Failed to update lead', { description: message });
      }
      console.error('Error:', error);
    }
  };

  const handleUpdate = async (formData: LeadFormData) => {
    await updateLead(formData);
  };

  const handleAutoSaveUpdate = async (formData: LeadFormData) => {
    await updateLead(formData, { keepEditing: true, silent: true });
  };

  const handleDelete = async () => {
    try {
      const headers = await getCrmApiHeaders();
      const response = await fetch(`/api/crm/v1/leads/${encodeURIComponent(String(id || ''))}`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });
      if (!response.ok) {
        const { error } = await scopedDb
          .from('leads')
          .delete()
          .eq('id', id);
        if (error) throw error;
      }

      toast.success('Lead deleted successfully');
      navigate('/dashboard/leads');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to delete lead', { description: message });
      console.error('Error:', error);
    }
  };

  const priority = useMemo(() => getScoreGrade(lead?.lead_score || 0), [lead?.lead_score]);
  const stage = useMemo(() => statusConfig[(lead?.status ?? 'new') as Lead['status']], [lead?.status]);
  const leadFormInitialData = useMemo(() => {
    if (!lead) return undefined;
    return {
      id: lead.id,
      first_name: lead.first_name,
      last_name: lead.last_name,
      company: lead.company ?? '',
      title: lead.title ?? '',
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      status: (lead.status === 'converted' ? 'new' : lead.status) as LeadFormData['status'],
      source: (['website', 'referral', 'email', 'phone', 'social', 'event', 'other'].includes(lead.source)
        ? (lead.source as LeadFormData['source'])
        : 'other'),
      estimated_value: lead.estimated_value != null ? String(lead.estimated_value) : '',
      expected_close_date: lead.expected_close_date ?? '',
      description: lead.description ?? '',
      notes: lead.notes ?? '',
      tenant_id: lead.tenant_id,
      franchise_id: lead.franchise_id ?? '',
      custom_fields: lead.custom_fields ?? {},
    };
  }, [lead]);

  const exportLead = async (format: 'csv' | 'xlsx') => {
    if (!lead) return;
    const headers = [
      'id',
      'first_name',
      'last_name',
      'company',
      'title',
      'email',
      'phone',
      'status',
      'source',
      'lead_score',
      'qualification_status',
      'estimated_value',
      'expected_close_date',
      'last_activity_date',
      'created_at',
      'updated_at',
    ];

    const rows = [
      {
        id: lead.id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        company: lead.company ?? '',
        title: lead.title ?? '',
        email: lead.email ?? '',
        phone: lead.phone ?? '',
        status: lead.status,
        source: lead.source ?? '',
        lead_score: lead.lead_score ?? '',
        qualification_status: lead.qualification_status ?? '',
        estimated_value: lead.estimated_value ?? '',
        expected_close_date: lead.expected_close_date ?? '',
        last_activity_date: lead.last_activity_date ?? '',
        created_at: lead.created_at,
        updated_at: lead.updated_at,
      },
    ];

    const filename = `lead_${lead.id}_${new Date().toISOString().slice(0, 10)}.${format === 'csv' ? 'csv' : 'xlsx'}`;
    if (format === 'csv') exportCsv(filename, headers, rows);
    else exportExcel(filename, headers, rows);
  };

  const exportActivities = async (format: 'csv' | 'xlsx') => {
    if (!lead) return;
    try {
      const [{ data: manual, error: manualError }, { data: automated, error: automatedError }] = await Promise.all([
        supabase
          .from('activities')
          .select('*')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('lead_activities' as any)
          .select('*')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: false }),
      ]);

      if (manualError) throw manualError;
      if (automatedError) throw automatedError;

      const rows = [
        ...(manual || []).map((a: any) => ({
          id: a.id,
          lead_id: a.lead_id,
          activity_type: a.activity_type,
          subject: a.subject ?? '',
          status: a.status ?? '',
          priority: a.priority ?? '',
          due_date: a.due_date ?? '',
          completed_at: a.completed_at ?? '',
          created_at: a.created_at ?? '',
          is_automated: false,
          description: a.description ?? '',
          to: a.custom_fields?.to ?? '',
          from: a.custom_fields?.from ?? '',
          metadata: '',
        })),
        ...(automated || []).map((a: any) => ({
          id: a.id,
          lead_id: a.lead_id,
          activity_type: a.type,
          subject: '',
          status: 'completed',
          priority: 'low',
          due_date: '',
          completed_at: a.created_at ?? '',
          created_at: a.created_at ?? '',
          is_automated: true,
          description: '',
          to: '',
          from: '',
          metadata: a.metadata ? JSON.stringify(a.metadata) : '',
        })),
      ].sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime());

      const headers = [
        'id',
        'lead_id',
        'activity_type',
        'subject',
        'status',
        'priority',
        'due_date',
        'completed_at',
        'created_at',
        'is_automated',
        'description',
        'to',
        'from',
        'metadata',
      ];

      const filename = `lead_${lead.id}_activities_${new Date().toISOString().slice(0, 10)}.${format === 'csv' ? 'csv' : 'xlsx'}`;
      if (format === 'csv') exportCsv(filename, headers, rows);
      else exportExcel(filename, headers, rows);

      toast.success('Export started');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Export failed', { description: message });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading lead...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lead not found</p>
        </div>
      </DashboardLayout>
    );
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-500/10 text-blue-500',
      contacted: 'bg-purple-500/10 text-purple-500',
      qualified: 'bg-teal-500/10 text-teal-500',
      proposal: 'bg-yellow-500/10 text-yellow-500',
      negotiation: 'bg-orange-500/10 text-orange-500',
      won: 'bg-green-500/10 text-green-500',
      lost: 'bg-red-500/10 text-red-500',
    };
    return colors[status] || 'bg-muted/50 text-muted-foreground';
  };

  const StickyActionsRegister = () => {
    const { setActions, clearActions } = useStickyActions();

    useEffect(() => {
      if (isEditing) {
        setActions({
          right: [
            <Button key="cancel-edit" variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>,
          ],
        });
        return () => clearActions();
      }

      setActions({
        right: [
          <Button key="new-lead" variant="outline" onClick={() => navigate('/dashboard/leads/new')}>
            New Lead
          </Button>,
          <Button key="edit-lead" variant="outline" onClick={() => setIsEditing(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>,
          <Button key="delete-lead" variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>,
        ],
      });

      return () => clearActions();
    }, [clearActions, isEditing, navigate, setActions]);

    return null;
  };

  return (
    <DashboardLayout>
      <StickyActionsRegister />
      <div style={themeStyleFromPreset(currentTheme)} className="transition-colors duration-300">
        <DetailScreenTemplate
          title={`${lead.first_name} ${lead.last_name}`}
          subtitle={
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Badge className={stage.color}>{stage.label}</Badge>
                <Badge className={`${priority.bg} ${priority.color}`}>{priority.label}</Badge>
                {lead.converted_at && (
                  <Badge className="bg-green-500/10 text-green-700 dark:text-green-300">
                    Converted {format(new Date(lead.converted_at), 'PPP')}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {lead.company && (
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    {lead.company}
                  </span>
                )}
                {lead.title && <span>{lead.title}</span>}
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <Mail className="h-4 w-4" />
                    {lead.email}
                  </a>
                )}
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <Phone className="h-4 w-4" />
                    {lead.phone}
                  </a>
                )}
              </div>
            </div>
          }
          actions={
            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
                  Dashboard
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/leads')}>
                  Leads
                </Button>
                <Badge variant="secondary">{`${lead.first_name} ${lead.last_name}`}</Badge>
              </div>
              <CRMModuleHeaderNavigation
                moduleLabel="Leads"
                viewMode="list"
                theme={currentTheme}
                onViewModeChange={(mode) => handleHeaderViewModeChange(mode as LeadsPrimaryView)}
                onThemeChange={handleThemeChange}
                onCreate={() => navigate('/dashboard/leads/new')}
                createLabel="New Lead"
                onRefresh={fetchLead}
                analyticsActive={false}
                onAnalyticsClick={() => {
                  try {
                    localStorage.setItem('leadsViewMode', 'pipeline');
                  } catch {
                    void 0;
                  }
                  scopedDb.logViewPreference('leads', 'pipeline');
                  setView('pipeline');
                  setPipeline({ q: '', status: [], tab: 'analytics' });
                  navigate('/dashboard/leads/pipeline?view=analytics');
                }}
                onImportExport={() => navigate('/dashboard/leads/import-export')}
                controlSequence={CRM_HEADER_PRIMARY_CONTROL_SEQUENCE}
                iconOnly
                layout="compact"
              />
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Badge variant={isEditing ? 'default' : 'outline'}>
                  {isEditing ? 'Editable Mode' : 'Read-only Mode'}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={isLeftPanelOpen ? "Collapse sidebar" : "Expand sidebar"}
                  onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
                >
                  {isLeftPanelOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                </Button>
                
                {!isEditing ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/dashboard/activities/new?leadId=${lead.id}&type=call`)}
                      disabled={!lead.phone}
                    >
                      <Phone className="mr-2 h-4 w-4" />
                      Call
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/dashboard/activities/new?leadId=${lead.id}&type=email`)}
                      disabled={!lead.email}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Email
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/dashboard/activities/new?leadId=${lead.id}&type=meeting`)}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Meeting
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                          <Download className="mr-2 h-4 w-4" />
                          Export
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Lead</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => exportLead('csv')}>Export Lead (CSV)</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => exportLead('xlsx')}>Export Lead (Excel)</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Activities</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => exportActivities('csv')}>Export Activities (CSV)</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => exportActivities('xlsx')}>Export Activities (Excel)</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <UsersIcon className="mr-2 h-4 w-4" />
                          Assign Lead
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Assign Lead</DialogTitle>
                          <DialogDescription>
                            Manually assign this lead to a user
                          </DialogDescription>
                        </DialogHeader>
                        <ManualAssignment
                          leadId={lead.id}
                          currentOwnerId={lead.owner_id}
                          onAssigned={() => {
                            setShowAssignmentDialog(false);
                            fetchLead();
                          }}
                        />
                      </DialogContent>
                    </Dialog>

                    {!lead.converted_at && (
                      <Button onClick={() => setShowConversionDialog(true)}>
                        <GitBranch className="mr-2 h-4 w-4" />
                        Convert Lead
                      </Button>
                    )}

                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          }
        >
        {isEditing ? (
          threeSectionLeadWorkspace ? (
            <LeadWorkspaceSections
              mode="edit"
              leadId={lead.id}
              initialData={leadFormInitialData}
              onSubmit={handleUpdate}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Edit Lead</CardTitle>
              </CardHeader>
              <CardContent>
                <LeadForm
                  initialData={leadFormInitialData}
                  onSubmit={handleUpdate}
                  onAutoSave={shouldAutoSaveInEditMode ? handleAutoSaveUpdate : undefined}
                  autoSave={shouldAutoSaveInEditMode}
                  onCancel={() => setIsEditing(false)}
                />
              </CardContent>
            </Card>
          )
        ) : (
          <div className={`grid grid-cols-1 gap-6 transition-all duration-300 ${isLeftPanelOpen ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
            {/* Left Column - Details */}
            {isLeftPanelOpen && (
              <div className="space-y-6">
                <LeadScoringCard
                  leadId={lead.id}
                  score={lead.lead_score || 0}
                  status={lead.status}
                  estimatedValue={lead.estimated_value}
                  lastActivityDate={lead.last_activity_date}
                  source={lead.source}
                  title={lead.title}
                />
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5" />
                      Lead Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Status</p>
                      <Badge className={`mt-1 ${getStatusColor(lead.status)}`}>{stage.label}</Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Source</p>
                      <Badge variant="outline" className="mt-1">{lead.source}</Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Priority</p>
                      <Badge className={`mt-1 ${priority.bg} ${priority.color}`}>{priority.label}</Badge>
                    </div>
                    {lead.company && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Company</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{lead.company}</span>
                        </div>
                      </div>
                    )}
                    {lead.title && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Title</p>
                        <p className="text-sm">{lead.title}</p>
                      </div>
                    )}
                    {(lead.custom_fields && (lead.custom_fields['hubspot_url'] || lead.custom_fields['salesforce_url'] || lead.custom_fields['external_crm_url'])) ? (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">CRM</p>
                        <a
                          className="mt-1 inline-flex text-sm text-primary hover:underline"
                          href={String(lead.custom_fields['external_crm_url'] || lead.custom_fields['salesforce_url'] || lead.custom_fields['hubspot_url'])}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in CRM
                        </a>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {lead.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${lead.email}`} className="text-sm text-primary hover:underline">
                          {lead.email}
                        </a>
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${lead.phone}`} className="text-sm">{lead.phone}</a>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Account Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {accountLoading ? (
                      <p className="text-sm text-muted-foreground">Loading account details...</p>
                    ) : accountDetails ? (
                      <button
                        type="button"
                        className="w-full space-y-2 text-left rounded-md border p-3 hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary"
                        onClick={() => navigate(`/dashboard/accounts/${accountDetails.id}`, {
                          state: {
                            openEdit: true,
                            autoSave: true,
                            returnTo: `/dashboard/leads/${lead.id}`,
                            leadId: lead.id,
                          },
                        })}
                        aria-label="Open linked account in edit mode"
                      >
                        <div className="text-sm"><span className="font-medium">Account Name:</span> {accountDetails.name || '-'}</div>
                        <div className="text-sm"><span className="font-medium">Industry:</span> {accountDetails.industry || '-'}</div>
                        <div className="text-sm"><span className="font-medium">Phone:</span> {accountDetails.phone || '-'}</div>
                        <div className="text-sm"><span className="font-medium">Website:</span> {accountDetails.website || '-'}</div>
                        <div className="text-sm"><span className="font-medium">Annual Revenue:</span> {accountDetails.annual_revenue != null ? `$${Number(accountDetails.annual_revenue).toLocaleString()}` : '-'}</div>
                        <div className="text-sm"><span className="font-medium">Primary Contact:</span> {accountDetails.primary_contact_name || '-'}</div>
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">{accountError || 'No linked account found for this lead.'}</p>
                        {accountError ? (
                          <Button size="sm" variant="outline" onClick={fetchLinkedAccount}>
                            Retry Account Load
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Opportunity Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {lead.estimated_value && (
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                          <DollarSign className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Estimated Value</p>
                          <p className="text-xl font-bold text-green-700">
                            ${lead.estimated_value?.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {lead.expected_close_date && (
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Expected Close</p>
                          <p className="text-sm font-semibold">{format(new Date(lead.expected_close_date), 'PPP')}</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-muted-foreground">Win Probability</span>
                        <span className="font-bold">{lead.lead_score || 0}%</span>
                      </div>
                      <Progress value={lead.lead_score || 0} className="h-2" />
                      <p className="text-xs text-muted-foreground">Based on current lead score</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Metadata</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <div>Created: {format(new Date(lead.created_at), 'PPpp')}</div>
                    <div>Last Updated: {format(new Date(lead.updated_at), 'PPpp')}</div>
                    {lead.lead_score && <div>Lead Score: {lead.lead_score}/100</div>}
                    {lead.qualification_status && <div>Qualification: {lead.qualification_status}</div>}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Right Column - Timeline & Activity */}
            <div className={`${isLeftPanelOpen ? 'lg:col-span-2' : ''} space-y-6`}>
              <Card>
                <CardHeader>
                  <CardTitle>Interaction Metrics</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                  <div className="space-y-1 p-3 rounded-lg bg-muted/50 text-center">
                    <div className="text-muted-foreground text-xs uppercase tracking-wider">Total</div>
                    <div className="text-2xl font-bold">{interactionStats?.total ?? '-'}</div>
                  </div>
                  <div className="space-y-1 p-3 rounded-lg bg-muted/50 text-center">
                    <div className="text-muted-foreground text-xs uppercase tracking-wider">Automated</div>
                    <div className="text-2xl font-bold">{interactionStats?.automated ?? '-'}</div>
                  </div>
                  <div className="space-y-1 p-3 rounded-lg bg-muted/50 text-center">
                    <div className="text-muted-foreground text-xs uppercase tracking-wider">Calls</div>
                    <div className="text-2xl font-bold">{interactionStats?.calls ?? '-'}</div>
                  </div>
                  <div className="space-y-1 p-3 rounded-lg bg-muted/50 text-center">
                    <div className="text-muted-foreground text-xs uppercase tracking-wider">Emails</div>
                    <div className="text-2xl font-bold">{interactionStats?.emails ?? '-'}</div>
                  </div>
                  <div className="space-y-1 p-3 rounded-lg bg-muted/50 text-center">
                    <div className="text-muted-foreground text-xs uppercase tracking-wider">Meetings</div>
                    <div className="text-2xl font-bold">{interactionStats?.meetings ?? '-'}</div>
                  </div>
                  <div className="space-y-1 p-3 rounded-lg bg-muted/50 text-center">
                    <div className="text-muted-foreground text-xs uppercase tracking-wider">Tasks</div>
                    <div className="text-2xl font-bold">{interactionStats ? interactionStats.tasks + interactionStats.notes : '-'}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>Additional Information</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={isDescriptionSaving || isNotesSaving ? 'default' : 'outline'}>
                        {isDescriptionSaving || isNotesSaving ? 'Auto-saving...' : 'Auto-save 30s'}
                      </Badge>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setInfoCollapsed(prev => !prev)}
                        aria-label={infoCollapsed ? 'Expand additional information' : 'Collapse additional information'}
                      >
                        {infoCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {lastInfoSavedAt ? `Last saved ${format(new Date(lastInfoSavedAt), 'PPpp')}` : 'Not saved yet'}
                  </p>
                </CardHeader>
                {!infoCollapsed ? (
                  <CardContent className="space-y-4">
                    <Tabs value={infoTab} onValueChange={(value) => setInfoTab(value === 'notes' ? 'notes' : 'description')} className="w-full">
                      <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent space-x-6">
                        <TabsTrigger
                          value="description"
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
                        >
                          Description
                        </TabsTrigger>
                        <TabsTrigger
                          value="notes"
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
                        >
                          Notes
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="description" className="pt-4 space-y-3">
                        <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/20 p-1">
                          <Button type="button" variant="ghost" size="sm" onClick={() => execInfoCommand('description', 'bold')} aria-label="Description bold"><Bold className="h-4 w-4" /></Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => execInfoCommand('description', 'italic')} aria-label="Description italic"><Italic className="h-4 w-4" /></Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => execInfoCommand('description', 'underline')} aria-label="Description underline"><Underline className="h-4 w-4" /></Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => execInfoCommand('description', 'insertUnorderedList')} aria-label="Description unordered list"><List className="h-4 w-4" /></Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => execInfoCommand('description', 'insertOrderedList')} aria-label="Description ordered list"><ListOrdered className="h-4 w-4" /></Button>
                          <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => upsertLeadDescription(descriptionHtml)} disabled={isDescriptionSaving}>
                            <Save className="h-3.5 w-3.5 mr-1" />
                            Save now
                          </Button>
                        </div>
                        <div
                          ref={descriptionEditorRef}
                          contentEditable
                          className="min-h-[140px] rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          onInput={(event) => {
                            const next = sanitizeRichTextHtml((event.target as HTMLDivElement).innerHTML);
                            setDescriptionHtml(next);
                            setDescriptionDirty(true);
                          }}
                        />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{stripHtmlTags(descriptionHtml).length}/5000 characters</span>
                          {descriptionSaveError ? <span className="text-destructive">{descriptionSaveError}</span> : null}
                        </div>
                      </TabsContent>
                      <TabsContent value="notes" className="pt-4 space-y-3">
                        <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/20 p-1">
                          <Button type="button" variant="ghost" size="sm" onClick={() => execInfoCommand('notes', 'bold')} aria-label="Notes bold"><Bold className="h-4 w-4" /></Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => execInfoCommand('notes', 'italic')} aria-label="Notes italic"><Italic className="h-4 w-4" /></Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => execInfoCommand('notes', 'underline')} aria-label="Notes underline"><Underline className="h-4 w-4" /></Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => execInfoCommand('notes', 'insertUnorderedList')} aria-label="Notes unordered list"><List className="h-4 w-4" /></Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => execInfoCommand('notes', 'insertOrderedList')} aria-label="Notes ordered list"><ListOrdered className="h-4 w-4" /></Button>
                          <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => upsertLeadNotes(notesHtml)} disabled={isNotesSaving}>
                            <Save className="h-3.5 w-3.5 mr-1" />
                            Save now
                          </Button>
                        </div>
                        <div
                          ref={notesEditorRef}
                          contentEditable
                          className="min-h-[160px] rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          onInput={(event) => {
                            const next = sanitizeRichTextHtml((event.target as HTMLDivElement).innerHTML);
                            setNotesHtml(next);
                            setNotesDirty(true);
                          }}
                        />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{stripHtmlTags(notesHtml).length}/10000 characters</span>
                          {notesSaveError ? <span className="text-destructive">{notesSaveError}</span> : null}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                ) : null}
              </Card>

              <Tabs value={tabValue} onValueChange={handleTabChange} className="w-full">
                <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent space-x-6">
                  <TabsTrigger 
                    value="activity" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
                  >
                    Activity Timeline
                  </TabsTrigger>
                  <TabsTrigger 
                    value="email" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
                  >
                    Email History
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="activity" className="pt-6">
                  <LeadActivitiesTimeline leadId={lead.id} />
                </TabsContent>
                
                <TabsContent value="email" className="pt-6">
                  <EmailClient 
                    entityType="lead"
                    entityId={lead.id}
                    emailAddress={lead.email}
                    className="mt-0"
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}

        {lead && (
          <LeadConversionDialog
            open={showConversionDialog}
            onOpenChange={setShowConversionDialog}
            lead={lead}
            onConversionComplete={fetchLead}
          />
        )}

        {lead && (
          <EmailComposeDialog
            open={composeOpen}
            onOpenChange={setComposeOpen}
            entityType="lead"
            entityId={lead.id}
            initialSubject={composeData?.subject}
            initialBody={composeData?.body}
            existingActivityId={composeData?.activityId}
            initialTo={lead.email ? [lead.email] : undefined}
          />
        )}

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Lead</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this lead? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </DetailScreenTemplate>
      </div>
    </DashboardLayout>
  );
}
