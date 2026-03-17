import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Globe, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FirstScreenTemplate } from '@/components/system/FirstScreenTemplate';
import { EmptyState } from '@/components/system/EmptyState';
import { DomainAssignmentAuditLog, DomainService, DomainTenantOption, PlatformDomain } from '@/services/DomainService';
import { useAuth } from '@/hooks/useAuth';

const ALL_FILTER_VALUE = '__all__';

export default function PlatformDomains() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isPlatformAdmin, hasPermission } = useAuth();
  const [domains, setDomains] = useState<PlatformDomain[]>([]);
  const [tenants, setTenants] = useState<DomainTenantOption[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [assignedDomainIds, setAssignedDomainIds] = useState<string[]>([]);
  const [draftDomainIds, setDraftDomainIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [auditRows, setAuditRows] = useState<DomainAssignmentAuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditTenantFilter, setAuditTenantFilter] = useState(ALL_FILTER_VALUE);
  const [auditDomainFilter, setAuditDomainFilter] = useState(ALL_FILTER_VALUE);
  const [auditBatchFilter, setAuditBatchFilter] = useState('');

  const canManageAssignments = useMemo(() => {
    return isPlatformAdmin() && (hasPermission('domains.assign') || hasPermission('domains.revoke'));
  }, [hasPermission, isPlatformAdmin]);

  useEffect(() => {
    fetchDomains();
    if (canManageAssignments) {
      fetchTenants();
      fetchAuditHistory();
    } else {
      setLoadingTenants(false);
    }
  }, [canManageAssignments]);

  useEffect(() => {
    if (!selectedTenantId || !canManageAssignments) {
      setAssignedDomainIds([]);
      setDraftDomainIds([]);
      return;
    }
    fetchTenantAssignments(selectedTenantId);
  }, [selectedTenantId, canManageAssignments]);

  const fetchDomains = async () => {
    try {
      const data = await DomainService.getAllDomains(true);
      setDomains(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const data = await DomainService.getTenantOptions();
      setTenants(data);
      if (!selectedTenantId && data.length > 0) {
        setSelectedTenantId(data[0].id);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoadingTenants(false);
    }
  };

  const fetchTenantAssignments = async (tenantId: string) => {
    setLoadingAssignments(true);
    try {
      const activeDomainIds = await DomainService.getTenantAssignedDomainIds(tenantId);
      setAssignedDomainIds(activeDomainIds);
      setDraftDomainIds(activeDomainIds);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoadingAssignments(false);
    }
  };

  const toggleDomainSelection = (domainId: string, checked: boolean) => {
    setDraftDomainIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, domainId]));
      }
      return current.filter((id) => id !== domainId);
    });
  };

  const handleSaveAssignments = async () => {
    if (!selectedTenantId) return;
    setSavingAssignments(true);
    try {
      const summary = await DomainService.setTenantDomains(selectedTenantId, draftDomainIds, assignedDomainIds);
      setAssignedDomainIds(draftDomainIds);
      toast({
        title: 'Domain assignments updated',
        description: `Assigned ${summary.assigned}, revoked ${summary.revoked}`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSavingAssignments(false);
    }
  };

  const fetchAuditHistory = async () => {
    if (!canManageAssignments) return;
    setLoadingAudit(true);
    try {
      const rows = await DomainService.getDomainAssignmentAuditHistory({
        tenantId: auditTenantFilter !== ALL_FILTER_VALUE ? auditTenantFilter : undefined,
        domainId: auditDomainFilter !== ALL_FILTER_VALUE ? auditDomainFilter : undefined,
        batchId: auditBatchFilter || undefined,
        limit: 100,
      });
      setAuditRows(rows);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoadingAudit(false);
    }
  };

  const hasAssignmentChanges = useMemo(() => {
    if (draftDomainIds.length !== assignedDomainIds.length) return true;
    const assignedSet = new Set(assignedDomainIds);
    return draftDomainIds.some((id) => !assignedSet.has(id));
  }, [assignedDomainIds, draftDomainIds]);

  const tenantNameById = useMemo(() => {
    return new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
  }, [tenants]);

  const domainNameById = useMemo(() => {
    return new Map(domains.map((domain) => [domain.id, domain.name]));
  }, [domains]);

  return (
    <DashboardLayout>
      <FirstScreenTemplate
        title="Platform Domains"
        description="Manage system-wide business domains"
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Platform Domains' }]}
        viewMode="list"
        availableModes={['list']}
        onCreate={() => navigate('/dashboard/settings/domains/new')}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              All Domains
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : domains.length === 0 ? (
              <EmptyState
                title="No domains found"
                description="Create your first platform domain."
                actionLabel="New Domain"
                onAction={() => navigate('/dashboard/settings/domains/new')}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((domain) => (
                    <TableRow
                      key={domain.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/dashboard/settings/domains/${domain.id}`)}
                    >
                      <TableCell className="font-medium">{domain.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {domain.code}
                        </Badge>
                      </TableCell>
                      <TableCell>{domain.description || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={domain.is_active ? 'default' : 'secondary'}>
                          {domain.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tenant Domain Assignments</CardTitle>
            <CardDescription>
              Assign one or more business domains to a tenant using role-based controls.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canManageAssignments ? (
              <div className="text-sm text-muted-foreground">
                Only platform administrators with domain assignment permissions can manage tenant domain access.
              </div>
            ) : loadingTenants ? (
              <div className="text-sm text-muted-foreground">Loading tenants...</div>
            ) : tenants.length === 0 ? (
              <div className="text-sm text-muted-foreground">No tenants available for assignment.</div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-[320px]">
                    <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select tenant" />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants.map((tenant) => (
                          <SelectItem key={tenant.id} value={tenant.id}>
                            {tenant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleSaveAssignments}
                    disabled={savingAssignments || loadingAssignments || !hasAssignmentChanges}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {savingAssignments ? 'Saving...' : 'Apply Assignments'}
                  </Button>
                </div>
                {loadingAssignments ? (
                  <div className="text-sm text-muted-foreground">Loading assignments...</div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {domains
                      .filter((domain) => domain.is_active)
                      .map((domain) => {
                        const checked = draftDomainIds.includes(domain.id);
                        return (
                          <label
                            key={domain.id}
                            className="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => toggleDomainSelection(domain.id, Boolean(value))}
                            />
                            <div className="space-y-1">
                              <div className="text-sm font-medium">{domain.name}</div>
                              <div className="text-xs text-muted-foreground">{domain.code}</div>
                            </div>
                          </label>
                        );
                      })}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Domain Assignment Audit</CardTitle>
            <CardDescription>
              Review assignment batches and filter by tenant, domain, and batch id.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canManageAssignments ? (
              <div className="text-sm text-muted-foreground">
                Only platform administrators with domain permissions can view assignment audit history.
              </div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-4">
                  <Select value={auditTenantFilter} onValueChange={setAuditTenantFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All tenants" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_FILTER_VALUE}>All tenants</SelectItem>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={auditDomainFilter} onValueChange={setAuditDomainFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All domains" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_FILTER_VALUE}>All domains</SelectItem>
                      {domains.map((domain) => (
                        <SelectItem key={domain.id} value={domain.id}>
                          {domain.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={auditBatchFilter}
                    onChange={(event) => setAuditBatchFilter(event.target.value)}
                    placeholder="Batch ID"
                  />
                  <Button onClick={fetchAuditHistory} disabled={loadingAudit}>
                    {loadingAudit ? 'Loading...' : 'Apply Filters'}
                  </Button>
                </div>
                {loadingAudit ? (
                  <div className="text-sm text-muted-foreground">Loading audit history...</div>
                ) : auditRows.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No audit history found for the selected filters.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Domain</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Actor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{new Date(row.created_at).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{row.action}</Badge>
                          </TableCell>
                          <TableCell>{row.tenant_id ? (tenantNameById.get(row.tenant_id) || row.tenant_id) : '-'}</TableCell>
                          <TableCell>{row.domain_id ? (domainNameById.get(row.domain_id) || row.domain_id) : '-'}</TableCell>
                          <TableCell className="font-mono text-xs">{row.batch_id || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">{row.actor_user_id || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </FirstScreenTemplate>
    </DashboardLayout>
  );
}
