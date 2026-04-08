import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowDownAZ, ArrowUpAZ, RotateCcw, Store, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCRM } from '@/hooks/useCRM';
import { ImportFranchiseModal } from '@/components/admin/ImportFranchiseModal';
import Papa from 'papaparse';
import { FirstScreenTemplate } from '@/components/system/FirstScreenTemplate';
import { EmptyState } from '@/components/system/EmptyState';
import { ViewMode } from '@/components/ui/view-toggle';
import { EntityCard } from '@/components/system/EntityCard';
import { logger } from '@/lib/logger';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TenantFranchiseMappingList } from "@/components/franchise/TenantFranchiseMappingList";

export default function Franchises() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { context, scopedDb } = useCRM();
  const [franchises, setFranchises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filterInputs, setFilterInputs] = useState({
    name: '',
    code: '',
    tenant: '',
    status: '',
    created: '',
  });
  const [filters, setFilters] = useState(filterInputs);
  const [sortState, setSortState] = useState<{
    key: 'name' | 'code' | 'tenant' | 'status' | 'created';
    direction: 'asc' | 'desc';
  }>({ key: 'created', direction: 'desc' });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setFilters(filterInputs);
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [filterInputs]);

  const fetchFranchises = useCallback(async () => {
    const parsePayload = async (response: Response): Promise<{ json: any | null; text: string; isJson: boolean }> => {
      const text = await response.text();
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      const isJson = contentType.includes('application/json');
      if (isJson) {
        try {
          return { json: JSON.parse(text), text, isJson: true };
        } catch {
          return { json: null, text, isJson: true };
        }
      }
      return { json: null, text, isJson: false };
    };

    const loadScopedFranchises = async (): Promise<any[]> => {
      const bypassScope = Boolean(context.isPlatformAdmin);
      let query = scopedDb
        .from('franchises', bypassScope)
        .select('id, name, code, tenant_id, is_active, created_at, address, tenants:tenants!franchises_tenant_id_fkey(name)')
        .order('created_at', { ascending: false });
      if (!context.isPlatformAdmin && context.tenantId) {
        query = query.eq('tenant_id', context.tenantId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    };

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || '';
      const response = await fetch('/api/v1/franchises', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(!context.isPlatformAdmin && context.tenantId ? { 'x-tenant-id': context.tenantId } : {}),
        },
      });

      const payload = await parsePayload(response);
      if (!payload.isJson) {
        logger.warn('Franchises API returned non-JSON response; falling back to scoped database query', {
          component: 'Franchises',
          status: response.status,
          tenantId: context.tenantId || null,
          isPlatformAdmin: context.isPlatformAdmin,
          preview: payload.text.slice(0, 120),
        });
        const fallbackRows = await loadScopedFranchises();
        setFranchises(fallbackRows);
        return;
      }

      if (!response.ok) {
        const apiErrorMessage = String(payload.json?.error || '');
        const isRouteNotFound = response.status === 404 || apiErrorMessage.toLowerCase().includes('route not found');
        if (isRouteNotFound) {
          logger.warn('Franchises API route unavailable; falling back to scoped database query', {
            component: 'Franchises',
            status: response.status,
            tenantId: context.tenantId || null,
            isPlatformAdmin: context.isPlatformAdmin,
            apiErrorMessage,
          });
          const fallbackRows = await loadScopedFranchises();
          setFranchises(fallbackRows);
          return;
        }
        throw new Error(apiErrorMessage || 'Failed to load franchises');
      }

      const apiRows = (() => {
        if (Array.isArray(payload.json?.data)) return payload.json.data;
        if (Array.isArray(payload.json?.output?.records)) return payload.json.output.records;
        if (Array.isArray(payload.json?.records)) return payload.json.records;
        return [];
      })();

      if (context.isPlatformAdmin && apiRows.length === 0) {
        const fallbackRows = await loadScopedFranchises();
        setFranchises(fallbackRows);
        return;
      }

      setFranchises(apiRows);
    } catch (error: any) {
      logger.error('Failed to fetch franchises', {
        component: 'Franchises',
        tenantId: context.tenantId || null,
        isPlatformAdmin: context.isPlatformAdmin,
        message: error?.message || String(error),
      });
      toast({
        title: 'Error',
        description: error?.message || 'Failed to load franchises',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [context.isPlatformAdmin, context.tenantId, scopedDb, toast]);

  useEffect(() => {
    fetchFranchises();
  }, [fetchFranchises]);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((value) => String(value || '').trim().length > 0).length,
    [filters],
  );

  const visibleFranchises = useMemo(() => {
    const normalize = (value: unknown) => String(value ?? '').toLowerCase();
    const hasToken = (value: unknown, token: string) => normalize(value).includes(token.toLowerCase());
    const filtered = franchises.filter((franchise) => {
      if (filters.name && !hasToken(franchise.name, filters.name)) return false;
      if (filters.code && !hasToken(franchise.code, filters.code)) return false;
      if (filters.tenant && !hasToken(franchise.tenants?.name || '', filters.tenant)) return false;
      if (filters.status && normalize(franchise.is_active ? 'active' : 'inactive') !== normalize(filters.status)) return false;
      if (filters.created) {
        const createdDate = new Date(franchise.created_at);
        if (Number.isNaN(createdDate.getTime())) return false;
        if (createdDate.toISOString().slice(0, 10) !== filters.created) return false;
      }
      return true;
    });

    return [...filtered].sort((left, right) => {
      const compareString = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
      const compareNumber = (a: number, b: number) => a - b;
      let value = 0;
      switch (sortState.key) {
        case 'name':
          value = compareString(String(left.name || ''), String(right.name || ''));
          break;
        case 'code':
          value = compareString(String(left.code || ''), String(right.code || ''));
          break;
        case 'tenant':
          value = compareString(String(left.tenants?.name || ''), String(right.tenants?.name || ''));
          break;
        case 'status':
          value = compareString(left.is_active ? 'active' : 'inactive', right.is_active ? 'active' : 'inactive');
          break;
        case 'created':
          value = compareNumber(new Date(left.created_at).getTime() || 0, new Date(right.created_at).getTime() || 0);
          break;
      }
      return sortState.direction === 'asc' ? value : -value;
    });
  }, [filters, franchises, sortState.direction, sortState.key]);

  const handleSort = useCallback((key: typeof sortState.key) => {
    setSortState((previous) => (
      previous.key === key
        ? { key, direction: previous.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    ));
  }, []);

  const clearFilter = useCallback((key: keyof typeof filterInputs) => {
    setFilterInputs((previous) => ({ ...previous, [key]: '' }));
  }, []);

  const clearAllFilters = useCallback(() => {
    const emptyFilters = { name: '', code: '', tenant: '', status: '', created: '' };
    setFilterInputs(emptyFilters);
    setFilters(emptyFilters);
  }, []);

  const handleExport = () => {
    try {
      const exportData = franchises.map(f => ({
        name: f.name,
        code: f.code,
        tenant: f.tenants?.name,
        status: f.is_active ? 'Active' : 'Inactive',
        created_at: new Date(f.created_at).toLocaleDateString(),
        street: f.address?.street || '',
        city: f.address?.city || '',
        state: f.address?.state || '',
        zip: f.address?.zip || '',
        country: f.address?.country || '',
        phone: f.address?.contact?.phone || '',
        email: f.address?.contact?.email || '',
      }));

      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `franchises_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      toast({
        title: 'Success',
        description: 'Franchises exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export franchises',
        variant: 'destructive',
      });
    }
  };

  return (
    <DashboardLayout>
      <FirstScreenTemplate
        title="Franchises"
        description="Manage franchise locations"
        breadcrumbs={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Franchises' },
        ]}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        availableModes={['card', 'grid', 'list']}
        onImport={() => setIsImportModalOpen(true)}
        onExport={handleExport}
        onCreate={() => navigate('/dashboard/franchises/new')}
      >

        <ImportFranchiseModal 
          open={isImportModalOpen} 
          onOpenChange={setIsImportModalOpen}
          onImportComplete={fetchFranchises}
        />

        <Tabs defaultValue="franchises" className="space-y-4">
          <TabsList>
            <TabsTrigger value="franchises">Franchises</TabsTrigger>
            <TabsTrigger value="mappings">Tenant Mappings</TabsTrigger>
          </TabsList>

          <TabsContent value="franchises">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  All Franchises
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : franchises.length === 0 ? (
                  <EmptyState
                    title="No franchises found"
                    description="Create your first franchise to get started."
                    actionLabel="New Franchise"
                    onAction={() => navigate('/dashboard/franchises/new')}
                  />
                ) : viewMode === 'list' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Showing {visibleFranchises.length} of {franchises.length} franchises</span>
                      <div className="flex items-center gap-2">
                        {activeFilterCount > 0 ? <Badge variant="secondary" className="text-xs">Filters active: {activeFilterCount}</Badge> : null}
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={clearAllFilters}>
                          <RotateCcw className="h-3 w-3" />
                          Reset Filters
                        </Button>
                      </div>
                    </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Button variant="ghost" size="sm" className="h-7 px-0 font-semibold" onClick={() => handleSort('name')}>
                            Name
                            {sortState.key === 'name' ? (sortState.direction === 'asc' ? <ArrowUpAZ className="ml-1 h-3.5 w-3.5" /> : <ArrowDownAZ className="ml-1 h-3.5 w-3.5" />) : null}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" className="h-7 px-0 font-semibold" onClick={() => handleSort('code')}>
                            Code
                            {sortState.key === 'code' ? (sortState.direction === 'asc' ? <ArrowUpAZ className="ml-1 h-3.5 w-3.5" /> : <ArrowDownAZ className="ml-1 h-3.5 w-3.5" />) : null}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" className="h-7 px-0 font-semibold" onClick={() => handleSort('tenant')}>
                            Tenant
                            {sortState.key === 'tenant' ? (sortState.direction === 'asc' ? <ArrowUpAZ className="ml-1 h-3.5 w-3.5" /> : <ArrowDownAZ className="ml-1 h-3.5 w-3.5" />) : null}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" className="h-7 px-0 font-semibold" onClick={() => handleSort('status')}>
                            Status
                            {sortState.key === 'status' ? (sortState.direction === 'asc' ? <ArrowUpAZ className="ml-1 h-3.5 w-3.5" /> : <ArrowDownAZ className="ml-1 h-3.5 w-3.5" />) : null}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" className="h-7 px-0 font-semibold" onClick={() => handleSort('created')}>
                            Created
                            {sortState.key === 'created' ? (sortState.direction === 'asc' ? <ArrowUpAZ className="ml-1 h-3.5 w-3.5" /> : <ArrowDownAZ className="ml-1 h-3.5 w-3.5" />) : null}
                          </Button>
                        </TableHead>
                      </TableRow>
                      <TableRow>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            <Input value={filterInputs.name} onChange={(event) => setFilterInputs((previous) => ({ ...previous, name: event.target.value }))} className={cn('h-7 text-xs', filterInputs.name && 'border-primary')} placeholder="Filter name" />
                            {filterInputs.name ? <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => clearFilter('name')}><X className="h-3 w-3" /></Button> : null}
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            <Input value={filterInputs.code} onChange={(event) => setFilterInputs((previous) => ({ ...previous, code: event.target.value }))} className={cn('h-7 text-xs', filterInputs.code && 'border-primary')} placeholder="Filter code" />
                            {filterInputs.code ? <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => clearFilter('code')}><X className="h-3 w-3" /></Button> : null}
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            <Input value={filterInputs.tenant} onChange={(event) => setFilterInputs((previous) => ({ ...previous, tenant: event.target.value }))} className={cn('h-7 text-xs', filterInputs.tenant && 'border-primary')} placeholder="Filter tenant" />
                            {filterInputs.tenant ? <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => clearFilter('tenant')}><X className="h-3 w-3" /></Button> : null}
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            <Select value={filterInputs.status || '__all__'} onValueChange={(value) => setFilterInputs((previous) => ({ ...previous, status: value === '__all__' ? '' : value }))}>
                              <SelectTrigger className={cn('h-7 text-xs', filterInputs.status && 'border-primary')}>
                                <SelectValue placeholder="All" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__all__">All</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                              </SelectContent>
                            </Select>
                            {filterInputs.status ? <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => clearFilter('status')}><X className="h-3 w-3" /></Button> : null}
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            <Input type="date" value={filterInputs.created} onChange={(event) => setFilterInputs((previous) => ({ ...previous, created: event.target.value }))} className={cn('h-7 text-xs', filterInputs.created && 'border-primary')} />
                            {filterInputs.created ? <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => clearFilter('created')}><X className="h-3 w-3" /></Button> : null}
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleFranchises.map((franchise) => (
                        <TableRow
                          key={franchise.id}
                          className="cursor-pointer"
                          onClick={() => navigate(`/dashboard/franchises/${franchise.id}`)}
                        >
                          <TableCell className="font-medium">{franchise.name}</TableCell>
                          <TableCell>{franchise.code}</TableCell>
                          <TableCell>{franchise.tenants?.name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={franchise.is_active ? 'default' : 'secondary'}>
                              {franchise.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(franchise.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                      {visibleFranchises.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                            No franchises match the active filters.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visibleFranchises.map((f) => (
                      <EntityCard
                        key={f.id}
                        title={f.name}
                        subtitle={`${f.code} • ${f.tenants?.name || '—'}`}
                        meta={`Created ${new Date(f.created_at).toLocaleDateString()}`}
                        tags={[f.is_active ? 'Active' : 'Inactive']}
                        onClick={() => navigate(`/dashboard/franchises/${f.id}`)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {visibleFranchises.map((f) => (
                      <EntityCard
                        key={f.id}
                        title={f.name}
                        subtitle={`${f.code} • ${f.tenants?.name || '—'}`}
                        meta={`Created ${new Date(f.created_at).toLocaleDateString()}`}
                        tags={[f.is_active ? 'Active' : 'Inactive']}
                        onClick={() => navigate(`/dashboard/franchises/${f.id}`)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mappings">
            <TenantFranchiseMappingList data={franchises} loading={loading} />
          </TabsContent>
        </Tabs>
      </FirstScreenTemplate>
    </DashboardLayout>
  );
}
