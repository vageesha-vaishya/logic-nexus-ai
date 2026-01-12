import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LeadForm } from '@/components/crm/LeadForm';
import type { LeadFormData } from '@/components/crm/LeadForm';
import type { Json } from '@/integrations/supabase/types';
import { LeadConversionDialog } from '@/components/crm/LeadConversionDialog';
import { LeadActivitiesTimeline } from '@/components/crm/LeadActivitiesTimeline';
import { EmailClient } from "@/components/email/EmailClient";
import { LeadScoringCard } from '@/components/crm/LeadScoringCard';
import { ManualAssignment } from '@/components/assignment/ManualAssignment';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, Download, Edit, Trash2, UserPlus, DollarSign, Calendar, Mail, Phone, Building2, GitBranch, Users as UsersIcon } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Lead, statusConfig } from './leads-data';
import { exportCsv, exportExcel } from '@/lib/import-export';
import { getScoreGrade } from '@/utils/leadScoring';

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { supabase, scopedDb } = useCRM();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showConversionDialog, setShowConversionDialog] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [interactionStats, setInteractionStats] = useState<{ total: number; calls: number; emails: number; meetings: number; tasks: number; notes: number; automated: number } | null>(null);

  const fetchLead = useCallback(async () => {
    try {
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
  }, [id, scopedDb]);

  useEffect(() => {
    if (id) {
      fetchLead();

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
  }, [id, fetchLead, supabase]);

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

  const handleUpdate = async (formData: LeadFormData) => {
    try {
      // Extract extras and merge into custom_fields
      const { service_id, attachments, ...rest } = formData || ({} as LeadFormData);
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
        ...(attachmentNames.length ? { attachments_names: attachmentNames } : {}),
      };

      const { error } = await supabase
        .from('leads')
        .update({
          ...payload,
          estimated_value: formData.estimated_value ? parseFloat(formData.estimated_value) : null,
          custom_fields: Object.keys(mergedCustomFields as Record<string, unknown>).length ? mergedCustomFields : null,
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Lead updated successfully');
      setIsEditing(false);
      fetchLead();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to update lead', { description: message });
      console.error('Error:', error);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await scopedDb
        .from('leads')
        .delete()
        .eq('id', id);

      if (error) throw error;

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
          <Button onClick={() => navigate('/dashboard/leads')} className="mt-4">
            Back to Leads
          </Button>
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
    return colors[status] || 'bg-gray-500/10 text-gray-500';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" aria-label="Back to leads" onClick={() => navigate('/dashboard/leads')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold">{lead.first_name} {lead.last_name}</h1>
                <Badge className={stage.color}>{stage.label}</Badge>
                <Badge className={`${priority.bg} ${priority.color}`}>{priority.label}</Badge>
                {lead.converted_at && (
                  <Badge className="bg-green-500/10 text-green-700 dark:text-green-300">
                    Converted {format(new Date(lead.converted_at), 'PPP')}
                  </Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {lead.company ? (
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    {lead.company}
                  </span>
                ) : null}
                {lead.title ? <span>{lead.title}</span> : null}
                {lead.email ? (
                  <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <Mail className="h-4 w-4" />
                    {lead.email}
                  </a>
                ) : null}
                {lead.phone ? (
                  <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <Phone className="h-4 w-4" />
                    {lead.phone}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
              </>
            ) : null}

            {!isEditing ? (
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
            ) : null}

            {!isEditing && !lead.converted_at && (
              <>
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
                <Button onClick={() => setShowConversionDialog(true)}>
                  <GitBranch className="mr-2 h-4 w-4" />
                  Convert Lead
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>

        {isEditing ? (
          <Card>
            <CardHeader>
              <CardTitle>Edit Lead</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadForm
                initialData={{
                  id: lead.id,
                  first_name: lead.first_name,
                  last_name: lead.last_name,
                  company: lead.company ?? '',
                  title: lead.title ?? '',
                  email: lead.email ?? '',
                  phone: lead.phone ?? '',
                  status: (lead.status === 'converted' ? 'new' : lead.status) as LeadFormData['status'],
                  source: (['website','referral','email','phone','social','event','other'].includes(lead.source)
                    ? (lead.source as LeadFormData['source'])
                    : 'other'),
                  estimated_value: lead.estimated_value != null ? String(lead.estimated_value) : '',
                  expected_close_date: lead.expected_close_date ?? '',
                  description: lead.description ?? '',
                  notes: lead.notes ?? '',
                  tenant_id: lead.tenant_id,
                  franchise_id: lead.franchise_id ?? '',
                }}
                onSubmit={handleUpdate}
                onCancel={() => setIsEditing(false)}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Details */}
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

            {/* Right Column - Timeline & Activity */}
            <div className="lg:col-span-2 space-y-6">
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

              {(lead.description || lead.notes) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Additional Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {lead.description && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
                        <p className="text-sm whitespace-pre-wrap">{lead.description}</p>
                      </div>
                    )}
                    {lead.notes && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Notes</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{lead.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Tabs defaultValue="activity" className="w-full">
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
      </div>
    </DashboardLayout>
  );
}
