import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowDownAZ, ArrowUpAZ, Building2, RotateCcw, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FirstScreenTemplate } from '@/components/system/FirstScreenTemplate';
import { EmptyState } from '@/components/system/EmptyState';
import { ViewMode } from '@/components/ui/view-toggle';
import { EntityCard } from '@/components/system/EntityCard';
import { useCRM } from '@/hooks/useCRM';
import { logger } from '@/lib/logger';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function Tenants() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { context, scopedDb } = useCRM();
  interface Tenant {
    id: string;
    name: string;
    slug: string;
    domain: string | null;
    domain_id?: string; // Added new field
    subscription_tier: string | null;
    is_active: boolean;
    created_at: string;
  }
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filterInputs, setFilterInputs] = useState({
    id: '',
    name: '',
    slug: '',
    domain: '',
    subscription: '',
    status: '',
    created: '',
  });
  const [filters, setFilters] = useState(filterInputs);
  const [sortState, setSortState] = useState<{
    key: 'id' | 'name' | 'slug' | 'domain' | 'subscription' | 'status' | 'created';
    direction: 'asc' | 'desc';
  }>({ key: 'created', direction: 'desc' });

  useEffect(() => {
    fetchTenants();
  }, [context.isPlatformAdmin, context.tenantId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setFilters(filterInputs);
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [filterInputs]);

  const resolveErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string' && error.trim()) return error;
    if (error && typeof error === 'object') {
      const message = (error as Record<string, unknown>).message;
      if (typeof message === 'string' && message.trim()) return message;
    }
    return 'Failed to load tenant data';
  };

  const fetchTenants = async () => {
    try {
      let query = scopedDb
        .from('tenants', true)
        .select('*')
        .order('created_at', { ascending: false });

      if (!context.isPlatformAdmin) {
        if (!context.tenantId) {
          setTenants([]);
          return;
        }
        query = query.eq('id', context.tenantId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTenants(data || []);
    } catch (error: unknown) {
      const message = resolveErrorMessage(error);
      logger.error('Failed to fetch tenants', {
        component: 'Tenants',
        tenantId: context.tenantId || null,
        isPlatformAdmin: context.isPlatformAdmin,
        message,
        error,
      });
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((value) => String(value || '').trim().length > 0).length,
    [filters],
  );

  const visibleTenants = useMemo(() => {
    const normalize = (value: unknown) => String(value ?? '').toLowerCase();
    const hasToken = (value: unknown, token: string) => normalize(value).includes(token.toLowerCase());
    const filtered = tenants.filter((tenant) => {
      if (filters.id && !hasToken(tenant.id, filters.id)) return false;
      if (filters.name && !hasToken(tenant.name, filters.name)) return false;
      if (filters.slug && !hasToken(tenant.slug, filters.slug)) return false;
      if (filters.domain && !hasToken(tenant.domain || '', filters.domain)) return false;
      if (filters.subscription && !hasToken(tenant.subscription_tier || 'Free', filters.subscription)) return false;
      if (filters.status && normalize(tenant.is_active ? 'active' : 'inactive') !== normalize(filters.status)) return false;
      if (filters.created) {
        const createdDate = new Date(tenant.created_at);
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
        case 'id':
          value = compareString(left.id, right.id);
          break;
        case 'name':
          value = compareString(left.name || '', right.name || '');
          break;
        case 'slug':
          value = compareString(left.slug || '', right.slug || '');
          break;
        case 'domain':
          value = compareString(left.domain || '', right.domain || '');
          break;
        case 'subscription':
          value = compareString(left.subscription_tier || 'Free', right.subscription_tier || 'Free');
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
  }, [filters, sortState.direction, sortState.key, tenants]);

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
    const empty = { id: '', name: '', slug: '', domain: '', subscription: '', status: '', created: '' };
    setFilterInputs(empty);
    setFilters(empty);
  }, []);

  return (
    <DashboardLayout>
      <FirstScreenTemplate
        title="Tenants"
        description="Manage organization tenants"
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Tenants' }]}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        availableModes={['card', 'grid', 'list']}
        onCreate={context.isPlatformAdmin ? () => navigate('/dashboard/tenants/new') : undefined}
      >

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              All Tenants
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : tenants.length === 0 ? (
              <EmptyState
                title="No tenants found"
                description="Create your first tenant to get started."
                actionLabel={context.isPlatformAdmin ? 'New Tenant' : undefined}
                onAction={context.isPlatformAdmin ? () => navigate('/dashboard/tenants/new') : undefined}
              />
            ) : viewMode === 'list' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Showing {visibleTenants.length} of {tenants.length} tenants</span>
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
                      <Button variant="ghost" size="sm" className="h-7 px-0 font-semibold" onClick={() => handleSort('id')}>
                        ID
                        {sortState.key === 'id' ? (sortState.direction === 'asc' ? <ArrowUpAZ className="ml-1 h-3.5 w-3.5" /> : <ArrowDownAZ className="ml-1 h-3.5 w-3.5" />) : null}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="h-7 px-0 font-semibold" onClick={() => handleSort('name')}>
                        Name
                        {sortState.key === 'name' ? (sortState.direction === 'asc' ? <ArrowUpAZ className="ml-1 h-3.5 w-3.5" /> : <ArrowDownAZ className="ml-1 h-3.5 w-3.5" />) : null}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="h-7 px-0 font-semibold" onClick={() => handleSort('slug')}>
                        Slug
                        {sortState.key === 'slug' ? (sortState.direction === 'asc' ? <ArrowUpAZ className="ml-1 h-3.5 w-3.5" /> : <ArrowDownAZ className="ml-1 h-3.5 w-3.5" />) : null}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="h-7 px-0 font-semibold" onClick={() => handleSort('domain')}>
                        Domain
                        {sortState.key === 'domain' ? (sortState.direction === 'asc' ? <ArrowUpAZ className="ml-1 h-3.5 w-3.5" /> : <ArrowDownAZ className="ml-1 h-3.5 w-3.5" />) : null}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="h-7 px-0 font-semibold" onClick={() => handleSort('subscription')}>
                        Subscription
                        {sortState.key === 'subscription' ? (sortState.direction === 'asc' ? <ArrowUpAZ className="ml-1 h-3.5 w-3.5" /> : <ArrowDownAZ className="ml-1 h-3.5 w-3.5" />) : null}
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
                        <Input value={filterInputs.id} onChange={(event) => setFilterInputs((previous) => ({ ...previous, id: event.target.value }))} className={cn('h-7 text-xs', filterInputs.id && 'border-primary')} placeholder="Filter id" />
                        {filterInputs.id ? <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => clearFilter('id')}><X className="h-3 w-3" /></Button> : null}
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Input value={filterInputs.name} onChange={(event) => setFilterInputs((previous) => ({ ...previous, name: event.target.value }))} className={cn('h-7 text-xs', filterInputs.name && 'border-primary')} placeholder="Filter name" />
                        {filterInputs.name ? <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => clearFilter('name')}><X className="h-3 w-3" /></Button> : null}
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Input value={filterInputs.slug} onChange={(event) => setFilterInputs((previous) => ({ ...previous, slug: event.target.value }))} className={cn('h-7 text-xs', filterInputs.slug && 'border-primary')} placeholder="Filter slug" />
                        {filterInputs.slug ? <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => clearFilter('slug')}><X className="h-3 w-3" /></Button> : null}
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Input value={filterInputs.domain} onChange={(event) => setFilterInputs((previous) => ({ ...previous, domain: event.target.value }))} className={cn('h-7 text-xs', filterInputs.domain && 'border-primary')} placeholder="Filter domain" />
                        {filterInputs.domain ? <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => clearFilter('domain')}><X className="h-3 w-3" /></Button> : null}
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Input value={filterInputs.subscription} onChange={(event) => setFilterInputs((previous) => ({ ...previous, subscription: event.target.value }))} className={cn('h-7 text-xs', filterInputs.subscription && 'border-primary')} placeholder="Filter subscription" />
                        {filterInputs.subscription ? <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => clearFilter('subscription')}><X className="h-3 w-3" /></Button> : null}
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
                  {visibleTenants.map((tenant) => (
                    <TableRow
                      key={tenant.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/dashboard/tenants/${tenant.id}`)}
                    >
                      <TableCell className="font-mono text-[11px]">{tenant.id}</TableCell>
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell>{tenant.slug}</TableCell>
                      <TableCell>{tenant.domain || '-'}</TableCell>
                      <TableCell>{tenant.subscription_tier || 'Free'}</TableCell>
                      <TableCell>
                        <Badge variant={tenant.is_active ? 'default' : 'secondary'}>
                          {tenant.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(tenant.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                  {visibleTenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                        No tenants match the active filters.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleTenants.map((t) => (
                  <EntityCard
                    key={t.id}
                    title={t.name}
                    subtitle={`${t.slug} • ${t.subscription_tier || 'Free'}`}
                    meta={`Created ${new Date(t.created_at).toLocaleDateString()}`}
                    tags={[t.is_active ? 'Active' : 'Inactive']}
                    onClick={() => navigate(`/dashboard/tenants/${t.id}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {visibleTenants.map((t) => (
                  <EntityCard
                    key={t.id}
                    title={t.name}
                    subtitle={`${t.slug} • ${t.subscription_tier || 'Free'}`}
                    meta={`Created ${new Date(t.created_at).toLocaleDateString()}`}
                    tags={[t.is_active ? 'Active' : 'Inactive']}
                    onClick={() => navigate(`/dashboard/tenants/${t.id}`)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </FirstScreenTemplate>
    </DashboardLayout>
  );
}
