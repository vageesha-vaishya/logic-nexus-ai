import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useCRM } from '@/hooks/useCRM';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { invokeFunction } from '@/lib/supabase-functions';
import { AlertCircle, CheckCircle2, Clock3, RefreshCw, ShieldAlert, TrendingUp } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';

type SessionStatus =
  | 'draft'
  | 'submitted'
  | 'payment_pending'
  | 'provisioning'
  | 'support_assisted'
  | 'active'
  | 'failed';

type SupportStatus = 'not_required' | 'open' | 'in_progress' | 'escalated' | 'resolved';
type SupportPriority = 'low' | 'medium' | 'high' | 'critical';

interface OnboardingSession {
  id: string;
  tenant_id: string;
  status: SessionStatus;
  current_step: string;
  support_status: SupportStatus;
  support_priority: SupportPriority;
  sla_due_at: string | null;
  last_activity_at: string | null;
  drop_off_risk_score: number;
  escalation_count: number;
  failure_reason: string | null;
  updated_at: string;
  created_at: string;
}

type OnboardingRequestStatus =
  | 'pending_verification'
  | 'email_verified'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'expired';

interface SelfServiceOnboardingRequest {
  id: string;
  status: OnboardingRequestStatus;
  organization_name: string;
  organization_slug: string;
  admin_email: string;
  admin_first_name: string;
  admin_last_name: string | null;
  verification_sent_at: string | null;
  verification_expires_at: string | null;
  verified_at: string | null;
  verification_attempt_count: number;
  failure_reason: string | null;
  request_payload: Record<string, any>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  tenant_id: string | null;
}

const statusVariant: Record<SessionStatus, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  draft: 'outline',
  submitted: 'secondary',
  payment_pending: 'secondary',
  provisioning: 'secondary',
  support_assisted: 'destructive',
  active: 'default',
  failed: 'destructive',
};

const supportVariant: Record<SupportStatus, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  not_required: 'outline',
  open: 'secondary',
  in_progress: 'secondary',
  escalated: 'destructive',
  resolved: 'default',
};

const priorityVariant: Record<SupportPriority, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  low: 'outline',
  medium: 'secondary',
  high: 'default',
  critical: 'destructive',
};

const requestStatusVariant: Record<OnboardingRequestStatus, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  pending_verification: 'secondary',
  email_verified: 'default',
  approved: 'default',
  rejected: 'destructive',
  in_progress: 'secondary',
  completed: 'default',
  failed: 'destructive',
  expired: 'outline',
};

export default function OnboardingOperations() {
  const { scopedDb, context } = useCRM();
  const { toast } = useToast();
  const [supportLoading, setSupportLoading] = useState(true);
  const [sessions, setSessions] = useState<OnboardingSession[]>([]);
  const [tenantNames, setTenantNames] = useState<Record<string, string>>({});

  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requests, setRequests] = useState<SelfServiceOnboardingRequest[]>([]);
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [requestDetailLoading, setRequestDetailLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SelfServiceOnboardingRequest | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [bulkOperation, setBulkOperation] = useState<'approve' | 'reject' | 'confirm_email' | 'trigger_verification_email'>('approve');
  const [bulkComment, setBulkComment] = useState('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [activeTab, setActiveTab] = useState('self-service');

  const [tenantFilter, setTenantFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [supportFilter, setSupportFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const invokeOnboardingFunction = async (body: Record<string, unknown>) => {
    const { data, error } = await invokeFunction<any>('self-service-onboarding', { body });
    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.error || 'Operation failed');
    }
    return data;
  };

  const fetchRequests = async () => {
    if (!context.isPlatformAdmin) {
      setRequests([]);
      setRequestsLoading(false);
      return;
    }
    try {
      setRequestsLoading(true);
      const data = await invokeOnboardingFunction({
        action: 'admin_list_requests',
        status: requestStatusFilter,
        search: requestSearch.trim() || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        limit: 200,
      });
      setRequests((data.requests || []) as SelfServiceOnboardingRequest[]);
      setSelectedBulkIds((current) => current.filter((id) => (data.requests || []).some((row: SelfServiceOnboardingRequest) => row.id === id)));
      if (selectedRequestId && !(data.requests || []).some((row: SelfServiceOnboardingRequest) => row.id === selectedRequestId)) {
        setSelectedRequestId(null);
        setSelectedRequest(null);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to load onboarding requests',
        variant: 'destructive',
      });
    } finally {
      setRequestsLoading(false);
    }
  };

  const fetchRequestDetail = async (requestId: string) => {
    try {
      setRequestDetailLoading(true);
      const data = await invokeOnboardingFunction({
        action: 'admin_get_request_detail',
        request_id: requestId,
      });
      setSelectedRequest(data.request as SelfServiceOnboardingRequest);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to load request details',
        variant: 'destructive',
      });
    } finally {
      setRequestDetailLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      setSupportLoading(true);
      let query: any = scopedDb
        .from('tenant_onboarding_sessions')
        .select(
          'id, tenant_id, status, current_step, support_status, support_priority, sla_due_at, last_activity_at, drop_off_risk_score, escalation_count, failure_reason, updated_at, created_at'
        )
        .order('updated_at', { ascending: false });

      if (context.isPlatformAdmin && tenantFilter !== 'all') {
        query = query.eq('tenant_id', tenantFilter);
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (supportFilter !== 'all') {
        query = query.eq('support_status', supportFilter);
      }
      if (priorityFilter !== 'all') {
        query = query.eq('support_priority', priorityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const nextSessions = ((data || []) as OnboardingSession[]).map((session) => ({
        ...session,
        support_status: (session.support_status || 'not_required') as SupportStatus,
        support_priority: (session.support_priority || 'medium') as SupportPriority,
        drop_off_risk_score: Number(session.drop_off_risk_score || 0),
        escalation_count: Number(session.escalation_count || 0),
      }));

      setSessions(nextSessions);

      const tenantIds = Array.from(new Set(nextSessions.map((item) => item.tenant_id).filter(Boolean)));
      if (tenantIds.length > 0) {
        const { data: tenantRows, error: tenantError } = await scopedDb
          .from('tenants', true)
          .select('id, name')
          .in('id', tenantIds);
        if (tenantError) throw tenantError;

        const mapped = (tenantRows || []).reduce((acc: Record<string, string>, row: any) => {
          acc[row.id] = row.name || row.id;
          return acc;
        }, {});
        setTenantNames(mapped);
      } else {
        setTenantNames({});
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to load onboarding operations',
        variant: 'destructive',
      });
    } finally {
      setSupportLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [context.isPlatformAdmin, requestStatusFilter, requestSearch, fromDate, toDate]);

  useEffect(() => {
    fetchSessions();
  }, [context, tenantFilter, statusFilter, supportFilter, priorityFilter]);

  useEffect(() => {
    if (!selectedRequestId) return;
    fetchRequestDetail(selectedRequestId);
  }, [selectedRequestId]);

  useEffect(() => {
    if (!context.isPlatformAdmin) return;
    const timer = window.setInterval(() => {
      fetchRequests();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [context.isPlatformAdmin, requestStatusFilter, requestSearch, fromDate, toDate]);

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter((session) => {
      const tenantName = (tenantNames[session.tenant_id] || '').toLowerCase();
      return (
        tenantName.includes(query) ||
        session.tenant_id.toLowerCase().includes(query) ||
        session.status.toLowerCase().includes(query) ||
        session.current_step.toLowerCase().includes(query) ||
        session.support_status.toLowerCase().includes(query)
      );
    });
  }, [sessions, tenantNames, search]);

  const analytics = useMemo(() => {
    const now = Date.now();
    const overdue = filteredSessions.filter((session) => {
      if (!session.sla_due_at) return false;
      if (session.support_status === 'resolved' || session.support_status === 'not_required') return false;
      return new Date(session.sla_due_at).getTime() < now;
    }).length;

    return {
      total: filteredSessions.length,
      paymentPending: filteredSessions.filter((item) => item.status === 'payment_pending').length,
      supportBacklog: filteredSessions.filter((item) =>
        item.support_status === 'open' || item.support_status === 'in_progress' || item.support_status === 'escalated'
      ).length,
      escalated: filteredSessions.filter((item) => item.support_status === 'escalated').length,
      highRisk: filteredSessions.filter((item) => item.drop_off_risk_score >= 70).length,
      overdue,
      completed: filteredSessions.filter((item) => item.status === 'active').length,
    };
  }, [filteredSessions]);

  const requestAnalytics = useMemo(() => {
    return {
      total: requests.length,
      pendingVerification: requests.filter((item) => item.status === 'pending_verification').length,
      pendingApproval: requests.filter((item) => item.status === 'email_verified').length,
      inProgress: requests.filter((item) => item.status === 'in_progress').length,
      completed: requests.filter((item) => item.status === 'completed').length,
      rejected: requests.filter((item) => item.status === 'rejected').length,
      failed: requests.filter((item) => item.status === 'failed' || item.status === 'expired').length,
    };
  }, [requests]);

  const updateSessionSupport = async (session: OnboardingSession, action: 'open' | 'start' | 'escalate' | 'resolve') => {
    try {
      setUpdatingId(session.id);
      const nowIso = new Date().toISOString();
      let patch: any = {};

      if (action === 'open') {
        patch = {
          status: 'support_assisted',
          support_status: 'open',
          support_requested_at: nowIso,
          support_priority: session.support_priority || 'medium',
        };
      }
      if (action === 'start') {
        patch = {
          status: 'support_assisted',
          support_status: 'in_progress',
        };
      }
      if (action === 'escalate') {
        patch = {
          status: 'support_assisted',
          support_status: 'escalated',
          support_priority: session.support_priority === 'critical' ? 'critical' : 'high',
          last_escalated_at: nowIso,
        };
      }
      if (action === 'resolve') {
        patch = {
          support_status: 'resolved',
          failure_reason: null,
        };
      }

      const { error } = await scopedDb.from('tenant_onboarding_sessions').update(patch).eq('id', session.id);
      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Onboarding support state updated',
      });
      await fetchSessions();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update onboarding support state',
        variant: 'destructive',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const runRequestAction = async (requestId: string, action: 'admin_trigger_verification_email' | 'admin_confirm_email' | 'admin_approve_request', comment?: string) => {
    try {
      setActionLoadingId(requestId);
      const body: Record<string, unknown> = { action, request_id: requestId };
      if (comment && comment.trim()) body.comment = comment.trim();
      await invokeOnboardingFunction(body);
      await Promise.all([fetchRequests(), selectedRequestId === requestId ? fetchRequestDetail(requestId) : Promise.resolve()]);
      toast({
        title: 'Success',
        description: 'Request updated successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update onboarding request',
        variant: 'destructive',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const submitReject = async () => {
    if (!rejectingRequestId) return;
    const comment = rejectComment.trim();
    if (!comment) {
      toast({
        title: 'Error',
        description: 'Rejection comment is required',
        variant: 'destructive',
      });
      return;
    }
    try {
      setActionLoadingId(rejectingRequestId);
      await invokeOnboardingFunction({
        action: 'admin_reject_request',
        request_id: rejectingRequestId,
        comment,
      });
      setRejectDialogOpen(false);
      setRejectComment('');
      setRejectingRequestId(null);
      await Promise.all([fetchRequests(), selectedRequestId === rejectingRequestId ? fetchRequestDetail(rejectingRequestId) : Promise.resolve()]);
      toast({
        title: 'Success',
        description: 'Request rejected successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to reject onboarding request',
        variant: 'destructive',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const runBulkAction = async () => {
    if (selectedBulkIds.length === 0) {
      toast({
        title: 'Error',
        description: 'Select at least one request',
        variant: 'destructive',
      });
      return;
    }
    if (bulkOperation === 'reject' && !bulkComment.trim()) {
      toast({
        title: 'Error',
        description: 'Rejection comment is required for bulk reject',
        variant: 'destructive',
      });
      return;
    }
    try {
      setActionLoadingId('bulk');
      await invokeOnboardingFunction({
        action: 'admin_bulk_action',
        operation: bulkOperation,
        request_ids: selectedBulkIds,
        comment: bulkComment.trim() || undefined,
      });
      setSelectedBulkIds([]);
      setBulkComment('');
      await fetchRequests();
      if (selectedRequestId) await fetchRequestDetail(selectedRequestId);
      toast({
        title: 'Success',
        description: 'Bulk operation completed',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Bulk operation failed',
        variant: 'destructive',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const toggleRequestSelection = (requestId: string, checked: boolean) => {
    setSelectedBulkIds((current) => {
      if (checked) return Array.from(new Set([...current, requestId]));
      return current.filter((id) => id !== requestId);
    });
  };

  const selectAllVisible = (checked: boolean) => {
    if (checked) {
      setSelectedBulkIds(requests.map((row) => row.id));
      return;
    }
    setSelectedBulkIds([]);
  };

  const tenantOptions = useMemo(() => {
    const names = sessions.map((session) => ({
      id: session.tenant_id,
      name: tenantNames[session.tenant_id] || session.tenant_id,
    }));
    const deduped = new Map<string, string>();
    names.forEach((row) => deduped.set(row.id, row.name));
    return Array.from(deduped.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions, tenantNames]);

  const formatRelative = (value: string | null) => {
    if (!value) return '-';
    const asDate = new Date(value);
    if (Number.isNaN(asDate.getTime())) return '-';
    return `${formatDistanceToNowStrict(asDate, { addSuffix: true })}`;
  };

  const formatSla = (value: string | null) => {
    if (!value) return '-';
    const due = new Date(value);
    if (Number.isNaN(due.getTime())) return '-';
    const isOverdue = due.getTime() < Date.now();
    return (
      <span className={isOverdue ? 'text-destructive font-medium' : ''}>
        {formatDistanceToNowStrict(due, { addSuffix: true })}
      </span>
    );
  };

  const formatPersonName = (request: SelfServiceOnboardingRequest) => {
    const fullName = `${request.admin_first_name || ''} ${request.admin_last_name || ''}`.trim();
    return fullName || request.admin_email;
  };

  if (!context.isPlatformAdmin) {
    return (
      <DashboardLayout>
        <Card>
          <CardHeader>
            <CardTitle>Onboarding Operations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Only Platform Owners can access manual approval operations.</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Onboarding Operations</h1>
            <p className="text-sm text-muted-foreground">Manual approvals for self-service onboarding and support operations</p>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              await Promise.all([fetchRequests(), fetchSessions()]);
              if (selectedRequestId) await fetchRequestDetail(selectedRequestId);
            }}
            disabled={supportLoading || requestsLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${supportLoading || requestsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="self-service">Self-Service Approvals</TabsTrigger>
            <TabsTrigger value="support">Support Queue</TabsTrigger>
          </TabsList>

          <TabsContent value="self-service" className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <span>Total Requests</span>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{requestAnalytics.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <span>Pending Verify</span>
                    <Clock3 className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{requestAnalytics.pendingVerification}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <span>Pending Approval</span>
                    <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{requestAnalytics.pendingApproval}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <span>In Progress</span>
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{requestAnalytics.inProgress}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <span>Completed</span>
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{requestAnalytics.completed}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <span>Rejected/Failed</span>
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{requestAnalytics.rejected + requestAnalytics.failed}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Request Filters</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Input
                  value={requestSearch}
                  onChange={(event) => setRequestSearch(event.target.value)}
                  placeholder="Search organization, email, requestor"
                />
                <Select value={requestStatusFilter} onValueChange={setRequestStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="pending_verification">Pending verification</SelectItem>
                    <SelectItem value="email_verified">Email verified</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                <Button
                  variant="outline"
                  onClick={() => {
                    setRequestSearch('');
                    setRequestStatusFilter('all');
                    setFromDate('');
                    setToDate('');
                  }}
                >
                  Clear Filters
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bulk Operations</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Select value={bulkOperation} onValueChange={(value) => setBulkOperation(value as typeof bulkOperation)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Operation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approve">Approve</SelectItem>
                    <SelectItem value="reject">Reject</SelectItem>
                    <SelectItem value="confirm_email">Confirm Email</SelectItem>
                    <SelectItem value="trigger_verification_email">Trigger Verification Email</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={selectedBulkIds.length}
                  disabled
                  readOnly
                  placeholder="Selected"
                />
                <Textarea
                  value={bulkComment}
                  onChange={(event) => setBulkComment(event.target.value)}
                  placeholder={bulkOperation === 'reject' ? 'Rejection comment (required)' : 'Optional comment'}
                  className="min-h-[40px]"
                />
                <Button disabled={actionLoadingId === 'bulk'} onClick={runBulkAction}>
                  Apply Bulk Action
                </Button>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
              <Card className="xl:col-span-3">
                <CardHeader>
                  <CardTitle>Self-Service Onboarding Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={requests.length > 0 && selectedBulkIds.length === requests.length}
                            onCheckedChange={(checked) => selectAllVisible(Boolean(checked))}
                          />
                        </TableHead>
                        <TableHead>Organization</TableHead>
                        <TableHead>Requestor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Email Verification</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requestsLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            Loading onboarding requests...
                          </TableCell>
                        </TableRow>
                      ) : requests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No onboarding requests found
                          </TableCell>
                        </TableRow>
                      ) : (
                        requests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedBulkIds.includes(request.id)}
                                onCheckedChange={(checked) => toggleRequestSelection(request.id, Boolean(checked))}
                              />
                            </TableCell>
                            <TableCell>
                              <button
                                type="button"
                                className="font-medium text-left hover:underline"
                                onClick={() => setSelectedRequestId(request.id)}
                              >
                                {request.organization_name}
                              </button>
                              <p className="text-xs text-muted-foreground">{request.organization_slug}</p>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{formatPersonName(request)}</div>
                              <div className="text-xs text-muted-foreground">{request.admin_email}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={requestStatusVariant[request.status]}>{request.status}</Badge>
                            </TableCell>
                            <TableCell>
                              {request.verified_at ? (
                                <span className="text-sm">{formatRelative(request.verified_at)}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Not verified</span>
                              )}
                            </TableCell>
                            <TableCell>{formatRelative(request.updated_at)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={actionLoadingId === request.id}
                                  onClick={() => runRequestAction(request.id, 'admin_trigger_verification_email')}
                                >
                                  Send Email
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={actionLoadingId === request.id}
                                  onClick={() => runRequestAction(request.id, 'admin_confirm_email')}
                                >
                                  Confirm
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={actionLoadingId === request.id}
                                  onClick={() => runRequestAction(request.id, 'admin_approve_request')}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={actionLoadingId === request.id}
                                  onClick={() => {
                                    setRejectingRequestId(request.id);
                                    setRejectComment('');
                                    setRejectDialogOpen(true);
                                  }}
                                >
                                  Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle>Request Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!selectedRequestId ? (
                    <p className="text-sm text-muted-foreground">Select a request to view details.</p>
                  ) : requestDetailLoading ? (
                    <p className="text-sm text-muted-foreground">Loading details...</p>
                  ) : selectedRequest ? (
                    <>
                      <div>
                        <Label>Organization</Label>
                        <p className="text-sm">{selectedRequest.organization_name}</p>
                      </div>
                      <div>
                        <Label>Requestor</Label>
                        <p className="text-sm">{formatPersonName(selectedRequest)}</p>
                        <p className="text-xs text-muted-foreground">{selectedRequest.admin_email}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Status</Label>
                          <div className="pt-1">
                            <Badge variant={requestStatusVariant[selectedRequest.status]}>{selectedRequest.status}</Badge>
                          </div>
                        </div>
                        <div>
                          <Label>Email Verification</Label>
                          <p className="text-sm">{selectedRequest.verified_at ? 'Verified' : 'Pending'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <Label>Submitted</Label>
                          <p className="text-sm">{formatRelative(selectedRequest.created_at)}</p>
                        </div>
                        <div>
                          <Label>Verification Sent</Label>
                          <p className="text-sm">{formatRelative(selectedRequest.verification_sent_at)}</p>
                        </div>
                        <div>
                          <Label>Verification Expires</Label>
                          <p className="text-sm">{formatRelative(selectedRequest.verification_expires_at)}</p>
                        </div>
                        <div>
                          <Label>Failure Reason</Label>
                          <p className="text-sm">{selectedRequest.failure_reason || '-'}</p>
                        </div>
                        <div>
                          <Label>Attached Documentation</Label>
                          <pre className="max-h-56 overflow-auto rounded-md bg-muted p-2 text-xs">
                            {JSON.stringify(selectedRequest.request_payload?.documents || selectedRequest.request_payload || {}, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Request details unavailable.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="support" className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <span>Total Sessions</span>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.total}</div>
                  <p className="text-xs text-muted-foreground">{analytics.completed} completed</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <span>Payment Pending</span>
                    <Clock3 className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.paymentPending}</div>
                  <p className="text-xs text-muted-foreground">Awaiting customer payment completion</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <span>Support Backlog</span>
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.supportBacklog}</div>
                  <p className="text-xs text-muted-foreground">{analytics.escalated} escalated</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <span>SLA + Risk</span>
                    <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.overdue}</div>
                  <p className="text-xs text-muted-foreground">{analytics.highRisk} high drop-off risk</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Support Queue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search tenant, status, step"
                  />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All status</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="payment_pending">Payment pending</SelectItem>
                      <SelectItem value="provisioning">Provisioning</SelectItem>
                      <SelectItem value="support_assisted">Support assisted</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={supportFilter} onValueChange={setSupportFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Support" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All support</SelectItem>
                      <SelectItem value="not_required">Not required</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="escalated">Escalated</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All priority</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={tenantFilter} onValueChange={setTenantFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All tenants</SelectItem>
                      {tenantOptions.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Support</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>SLA Due</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supportLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Loading onboarding sessions...
                        </TableCell>
                      </TableRow>
                    ) : filteredSessions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          No onboarding sessions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSessions.map((session) => (
                        <TableRow key={session.id}>
                          <TableCell className="font-medium">{tenantNames[session.tenant_id] || session.tenant_id}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant={statusVariant[session.status]}>{session.status}</Badge>
                              <span className="text-xs text-muted-foreground">{session.current_step}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={supportVariant[session.support_status]}>{session.support_status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={priorityVariant[session.support_priority]}>{session.support_priority}</Badge>
                          </TableCell>
                          <TableCell>{formatSla(session.sla_due_at)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={session.drop_off_risk_score >= 70 ? 'text-destructive font-semibold' : ''}>
                                {session.drop_off_risk_score}
                              </span>
                              {session.drop_off_risk_score >= 70 ? <AlertCircle className="h-4 w-4 text-destructive" /> : null}
                            </div>
                          </TableCell>
                          <TableCell>{formatRelative(session.updated_at || session.last_activity_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {session.support_status === 'not_required' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={updatingId === session.id}
                                  onClick={() => updateSessionSupport(session, 'open')}
                                >
                                  Open
                                </Button>
                              ) : null}
                              {session.support_status === 'open' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={updatingId === session.id}
                                  onClick={() => updateSessionSupport(session, 'start')}
                                >
                                  Start
                                </Button>
                              ) : null}
                              {(session.support_status === 'open' || session.support_status === 'in_progress') ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={updatingId === session.id}
                                  onClick={() => updateSessionSupport(session, 'escalate')}
                                >
                                  Escalate
                                </Button>
                              ) : null}
                              {session.support_status !== 'resolved' && session.support_status !== 'not_required' ? (
                                <Button
                                  size="sm"
                                  disabled={updatingId === session.id}
                                  onClick={() => updateSessionSupport(session, 'resolve')}
                                >
                                  <CheckCircle2 className="mr-1 h-4 w-4" />
                                  Resolve
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Onboarding Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-comment">Rejection comment</Label>
            <Textarea
              id="reject-comment"
              value={rejectComment}
              onChange={(event) => setRejectComment(event.target.value)}
              placeholder="Enter rejection reason"
              className="min-h-[120px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectComment('');
                setRejectingRequestId(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitReject} disabled={Boolean(actionLoadingId)}>
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
