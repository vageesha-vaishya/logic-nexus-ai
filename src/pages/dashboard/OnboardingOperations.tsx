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

export default function OnboardingOperations() {
  const { scopedDb, context } = useCRM();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<OnboardingSession[]>([]);
  const [tenantNames, setTenantNames] = useState<Record<string, string>>({});
  const [tenantFilter, setTenantFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [supportFilter, setSupportFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [context, tenantFilter, statusFilter, supportFilter, priorityFilter]);

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Onboarding Operations</h1>
            <p className="text-sm text-muted-foreground">Monitor onboarding support queue, SLA risk, and payment progression</p>
          </div>
          <Button variant="outline" onClick={fetchSessions} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

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
              {context.isPlatformAdmin ? (
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
              ) : (
                <div />
              )}
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
                {loading ? (
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
      </div>
    </DashboardLayout>
  );
}
