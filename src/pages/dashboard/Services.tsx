import { useEffect, useMemo, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Plus, Pencil, Eye } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { useDebug } from '@/hooks/useDebug';

import { ServiceAttributeRenderer } from '@/components/services/ServiceAttributeRenderer';
import { ServiceHistoryPanel } from '@/components/sales/history/ServiceHistoryPanel';
import { ServiceVendorsPanel } from '@/components/logistics/ServiceVendorsPanel';

type ServiceRow = {
  id: string;
  tenant_id: string;
  service_name: string;
  service_type: string;
  service_type_id: string | null;
  service_code: string | null;
  description: string | null;
  pricing_unit: string | null;
  base_price: number | null;
  transit_time_days: number | null;
  is_active: boolean;
};

export default function Services() {
  const { supabase, scopedDb, context } = useCRM();
  const debug = useDebug('Services', 'ServiceList');
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [types, setTypes] = useState<{ id: string; name: string; is_active: boolean }[]>([]);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [serviceCode, setServiceCode] = useState('');
  const [description, setDescription] = useState('');
  const [pricingUnit, setPricingUnit] = useState('');
  const [basePrice, setBasePrice] = useState<number | ''>('');
  const [transitDays, setTransitDays] = useState<number | ''>('');
  const [isActive, setIsActive] = useState(true);
  const [attributes, setAttributes] = useState<Record<string, any>>({});

  const [editOpen, setEditOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ServiceRow | null>(null);
  const [editServiceName, setEditServiceName] = useState('');
  const [editServiceType, setEditServiceType] = useState('');
  const [editServiceCode, setEditServiceCode] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPricingUnit, setEditPricingUnit] = useState('');
  const [editBasePrice, setEditBasePrice] = useState<number | ''>('');
  const [editTransitDays, setEditTransitDays] = useState<number | ''>('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editTenantId, setEditTenantId] = useState('');
  const [editMigrateMappings, setEditMigrateMappings] = useState(false);
  const [editAttributes, setEditAttributes] = useState<Record<string, any>>({});

  const [viewRow, setViewRow] = useState<ServiceRow | null>(null);
  const [viewAttributes, setViewAttributes] = useState<Record<string, any>>({});
  const [viewOpen, setViewOpen] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mappingsCount, setMappingsCount] = useState<number>(0);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const STRICT_DISALLOW_TENANT_CHANGE_WITH_MAPPINGS = false;
  // Search / filter / sort for listing
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all'|'active'|'inactive'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [listTenantFilter, setListTenantFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<'name'|'type'|'tenant'|'price'|'time'|'status'>('name');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');

  const isTenantAdmin = context.isTenantAdmin;
  const isPlatform = context.isPlatformAdmin;
  const isAdmin = isTenantAdmin || isPlatform;
  const tenantId = context.tenantId || null;

  const fetchTypes = useCallback(async () => {
    try {
      const { data, error } = await scopedDb
        .from('service_types', true)
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setTypes((data || []) as { id: string; name: string; is_active: boolean }[]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      debug.error('Failed to fetch service types', { error: message });
    }
  }, [supabase]);

  const fetchTenants = useCallback(async () => {
    try {
      const { data, error } = await scopedDb
        .from('tenants', true)
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setTenants((data || []) as { id: string; name: string }[]);
      debug.log('Tenants fetched', { count: data?.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      debug.error('Failed to fetch tenants', { error: message });
      toast.error('Failed to fetch tenants', { description: message });
    }
  }, [supabase, toast]);

  const fetchServices = useCallback(async () => {
    try {
      // Platform admins can view all services across tenants; others are tenant-scoped
      // scopedDb handles tenant scoping automatically for non-platform users
      let query = scopedDb
        .from('services')
        .select('id, tenant_id, service_name, service_type, service_type_id, service_code, description, pricing_unit, base_price, transit_time_days, is_active')
        .order('service_name');

      if (!isPlatform && !tenantId) {
         return; // non-admin without tenant context: nothing to show
      }
      // Note: original code manually filtered by tenantId if !isPlatform. 
      // scopedDb does this automatically, so we don't need to add .eq('tenant_id', tenantId) explicitly 
      // unless we want to be doubly sure, but scopedDb is designed for this.

      const { data, error } = await query;
      if (error) throw error;
      setServices((data || []) as ServiceRow[]);
      debug.log('Services fetched', { count: data?.length, tenantId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      debug.error('Failed to fetch services', { error: message });
      toast.error('Failed to fetch services', { description: message });
    }
  }, [supabase, isPlatform, tenantId, toast]);

  useEffect(() => {
    fetchTypes();
    fetchServices();
    if (isPlatform) fetchTenants();
  }, [tenantId, isPlatform, fetchTypes, fetchServices, fetchTenants]);

  const resetForm = () => {
    setServiceName('');
    setServiceType('');
    setServiceCode('');
    setDescription('');
    setPricingUnit('');
    setBasePrice('');
    setTransitDays('');
    setIsActive(true);
    setAttributes({});
  };

  const resetEditForm = () => {
    setEditingRow(null);
    setEditServiceName('');
    setEditServiceType('');
    setEditServiceCode('');
    setEditDescription('');
    setEditPricingUnit('');
    setEditBasePrice('');
    setEditTransitDays('');
    setEditIsActive(true);
    setEditTenantId('');
    setEditMigrateMappings(false);
    setEditAttributes({});
  };

  const handleCreate = async () => {
    try {
      const targetTenantId = isPlatform ? (selectedTenantId || tenantId) : tenantId;
      if (!targetTenantId) {
        toast.error('Select a tenant to create service');
        return;
      }
      if (!isAdmin) {
        toast.error('Only admins can create services');
        return;
      }
      if (!serviceName.trim()) {
        toast.error('Service name is required');
        return;
      }
      if (!serviceCode.trim()) {
        toast.error('Service code is required');
        return;
      }
      const chosenTypeObj = types.find(t => t.name === (serviceType || resolvedDefaultServiceType));
      const chosenType = chosenTypeObj?.name;
      const chosenTypeId = chosenTypeObj?.id;

      if (!chosenType) {
        toast.error('No active service types available', { description: 'Activate at least one type under Service Types.' });
        return;
      }
      const payload: {
        tenant_id: string;
        service_name: string;
        service_type: string;
        service_type_id: string | null;
        service_code: string | null;
        description: string | null;
        pricing_unit: string | null;
        base_price: number | null;
        transit_time_days: number | null;
        is_active: boolean;
      } = {
        tenant_id: targetTenantId,
        service_name: serviceName.trim(),
        service_type: chosenType,
        service_type_id: chosenTypeId || null,
        service_code: serviceCode || null,
        description: description || null,
        pricing_unit: pricingUnit || null,
        base_price: basePrice === '' ? null : Number(basePrice),
        transit_time_days: transitDays === '' ? null : Number(transitDays),
        is_active: isActive,
      };
      const { data, error } = await scopedDb.from('services').insert(payload).select().single();
      if (error) throw error;

      // Insert attributes if any
      if (data && Object.keys(attributes).length > 0) {
        const { error: attrError } = await scopedDb.from('service_details').insert({
          service_id: data.id,
          attributes: attributes
        });
        if (attrError) {
           debug.error('Failed to save service attributes:', attrError);
           toast.error('Service created but failed to save attributes');
        }
      }

      toast.success('Service created');
      setOpen(false);
      resetForm();
      fetchServices();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Failed to create service', { description: message });
    }
  };

  const handleToggleActive = async (row: ServiceRow, next: boolean) => {
    try {
      if (!isAdmin) {
        toast.error('Only admins can update services');
        return;
      }
      const { error } = await scopedDb
        .from('services')
        .update({ is_active: next })
        .eq('id', row.id);
      if (error) throw error;
      fetchServices();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Failed to update service', { description: message });
    }
  };

  const handleDelete = async (row: ServiceRow) => {
    try {
      if (!isAdmin) {
        toast.error('Only admins can delete services');
        return;
      }
      const { error } = await scopedDb
        .from('services')
        .delete()
        .eq('id', row.id);
      if (error) throw error;
      toast.success('Service deleted');
      fetchServices();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Failed to delete service', { description: message });
    }
  };

  const openEdit = (row: ServiceRow) => {
    setEditingRow(row);
    setEditServiceName(row.service_name);
    setEditServiceType(row.service_type);
    setEditServiceCode(row.service_code || '');
    setEditDescription(row.description || '');
    setEditPricingUnit(row.pricing_unit || '');
    setEditBasePrice(row.base_price ?? '');
    setEditTransitDays(row.transit_time_days ?? '');
    setEditIsActive(row.is_active);
    setEditTenantId(row.tenant_id);
    setEditMigrateMappings(false);
    setEditOpen(true);

    // Fetch attributes
    scopedDb.from('service_details').select('attributes').eq('service_id', row.id).maybeSingle().then(({data}) => {
        setEditAttributes(data?.attributes || {});
     });
  };

  const openView = (row: ServiceRow) => {
    setViewRow(row);
    setViewOpen(true);
    // Fetch attributes
    scopedDb.from('service_details').select('attributes').eq('service_id', row.id).maybeSingle().then(({data}) => {
       setViewAttributes(data?.attributes || {});
    });
  };

  const doSaveWithMigrationIfNeeded = async () => {
    try {
      if (!isAdmin || !editingRow) return;
      if (!editServiceCode.trim()) {
        toast.error('Service code is required');
        return;
      }
      const payload: {
        service_name: string;
        service_code: string | null;
        description: string | null;
        pricing_unit: string | null;
        base_price: number | null;
        transit_time_days: number | null;
        is_active: boolean;
        tenant_id?: string;
      } = {
        service_name: editServiceName.trim(),
        service_code: editServiceCode || null,
        description: editDescription || null,
        pricing_unit: editPricingUnit || null,
        base_price: editBasePrice === '' ? null : Number(editBasePrice),
        transit_time_days: editTransitDays === '' ? null : Number(editTransitDays),
        is_active: editIsActive,
      };
      if (isPlatform && editTenantId) {
        // If tenant changed and migration toggled, update mappings first
        if (editTenantId !== editingRow.tenant_id && editMigrateMappings && mappingsCount > 0) {
          const { error: migError } = await supabase
            .from('service_type_mappings')
            .update({ tenant_id: editTenantId })
            .eq('service_id', editingRow.id)
            .eq('tenant_id', editingRow.tenant_id);
          if (migError) throw migError;
        }
        payload.tenant_id = editTenantId;
      }
      const { error } = await scopedDb
        .from('services')
        .update(payload)
        .eq('id', editingRow.id);
      if (error) throw error;

      // Upsert attributes
      if (editAttributes) {
         const { data: existingDetails } = await scopedDb.from('service_details').select('id').eq('service_id', editingRow.id).maybeSingle();
         if (existingDetails) {
             await scopedDb.from('service_details').update({ attributes: editAttributes }).eq('id', existingDetails.id);
         } else {
             await scopedDb.from('service_details').insert({ service_id: editingRow.id, attributes: editAttributes });
         }
      }

      toast.success('Service updated');
      setEditOpen(false);
      setConfirmOpen(false);
      resetEditForm();
      fetchServices();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Failed to update service', { description: message });
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleUpdate = async () => {
    try {
      if (!isAdmin) {
        toast.error('Only admins can update services');
        return;
      }
      if (!editingRow) return;
      if (!editServiceName.trim()) {
        toast.error('Service name is required');
        return;
      }
      if (isPlatform && !editTenantId) {
        toast.error('Select a tenant for this service');
        return;
      }

      // If platform admin is changing tenant, check mappings and ask confirmation
      if (isPlatform && editTenantId && editTenantId !== editingRow.tenant_id) {
        const { count, error: countError } = await supabase
          .from('service_type_mappings')
          .select('id', { count: 'exact', head: true })
          .eq('service_id', editingRow.id)
          .eq('tenant_id', editingRow.tenant_id);
        if (countError) throw countError;
        const existing = count || 0;
        setMappingsCount(existing);
        if (existing > 0) {
          if (STRICT_DISALLOW_TENANT_CHANGE_WITH_MAPPINGS) {
            toast.error('Tenant change is not allowed because mappings exist. Remove mappings first.');
            return;
          }
          setConfirmOpen(true);
          return; // wait for confirmation
        }
      }
      await doSaveWithMigrationIfNeeded();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Failed to update service', { description: message });
    }
  };

  const activeTypes = useMemo(() => types.filter(t => t.is_active), [types]);
  // Map friendly DB type names to canonical codes for services.service_type
  const toCanonicalType = (name: string) => {
    const n = String(name || '').trim().toLowerCase();
    const direct: Record<string,string> = {
      'ocean': 'ocean',
      'ocean freight': 'ocean',
      'sea': 'ocean',
      'sea freight': 'ocean',
      'sea cargo': 'ocean',
      'air': 'air',
      'air freight': 'air',
      'air cargo': 'air',
      'trucking': 'trucking',
      'inland trucking': 'trucking',
      'truck': 'trucking',
      'road': 'trucking',
      'road transport': 'trucking',
      'road freight': 'trucking',
      'courier': 'courier',
      'courier service': 'courier',
      'express': 'courier',
      'express delivery': 'courier',
      'express_delivery': 'courier',
      'parcel': 'courier',
      'moving': 'moving',
      'moving service': 'moving',
      'movers': 'moving',
      'movers packers': 'moving',
      'packers and movers': 'moving',
      'rail': 'railway_transport',
      'railway': 'railway_transport',
      'railway transport': 'railway_transport',
      'rail transport': 'railway_transport',
    };
    return direct[n] || String(name);
  };
  const displayTypes = useMemo(() => {
    if (activeTypes.length > 0) return activeTypes;
    // Fallback to common types if none active are found in DB
    const FALLBACK = ['ocean','air','trucking','courier','moving','railway_transport'];
    return FALLBACK.map((name) => ({ name, is_active: true }));
  }, [activeTypes]);
  const resolvedDefaultServiceType = useMemo(() => {
    const first = String(displayTypes[0]?.name || '');
    return toCanonicalType(first);
  }, [displayTypes]);
  const tenantNameById = useMemo(() => Object.fromEntries(tenants.map(t => [t.id, t.name])), [tenants]);
  const visibleServices = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = services.filter((s) => {
      const matchesSearch = term === ''
        ? true
        : [s.service_name, s.service_type, s.service_code || '', s.description || '']
            .some(v => String(v).toLowerCase().includes(term));
      const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'active' ? s.is_active : !s.is_active;
      const matchesType = typeFilter === 'all' ? true : s.service_type === typeFilter;
      const matchesTenant = !isPlatform ? true : (listTenantFilter === 'all' ? true : s.tenant_id === listTenantFilter);
      return matchesSearch && matchesStatus && matchesType && matchesTenant;
    });
    const cmp = (a: ServiceRow, b: ServiceRow) => {
      let av: string | number; let bv: string | number;
      if (sortKey === 'name') { av = a.service_name.toLowerCase(); bv = b.service_name.toLowerCase(); }
      else if (sortKey === 'type') { av = String(a.service_type).toLowerCase(); bv = String(b.service_type).toLowerCase(); }
      else if (sortKey === 'tenant') { av = String(tenantNameById[a.tenant_id] || a.tenant_id).toLowerCase(); bv = String(tenantNameById[b.tenant_id] || b.tenant_id).toLowerCase(); }
      else if (sortKey === 'price') { av = a.base_price ?? Number.POSITIVE_INFINITY; bv = b.base_price ?? Number.POSITIVE_INFINITY; }
      else if (sortKey === 'time') { av = a.transit_time_days ?? Number.POSITIVE_INFINITY; bv = b.transit_time_days ?? Number.POSITIVE_INFINITY; }
      else { av = a.is_active ? 1 : 0; bv = b.is_active ? 1 : 0; }
      const base = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? base : -base;
    };
    return filtered.sort(cmp);
  }, [services, search, statusFilter, typeFilter, listTenantFilter, sortKey, sortDir, isPlatform, tenantNameById]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Services</h1>
          <p className="text-muted-foreground">Create and manage tenant services.</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Services</CardTitle>
              <CardDescription>
                Tenant-scoped services available for quotes and mappings. Platform admins can manage across tenants.
              </CardDescription>
            </div>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button disabled={!isAdmin}>
                  <Plus className="mr-2 h-4 w-4" /> Add Service
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Service</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {isPlatform && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tenant</label>
                      <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                        <SelectTrigger>
                          <SelectValue placeholder={tenants.length === 0 ? 'No tenants' : 'Select tenant'} />
                        </SelectTrigger>
                        <SelectContent>
                          {tenants.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">No tenants available</div>
                          ) : (
                            tenants.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Service Name</label>
                    <Input value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="e.g. Ocean Standard" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <Select value={serviceType} onValueChange={setServiceType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {displayTypes.map((t) => {
                          const val = toCanonicalType(t.name);
                          return (
                            <SelectItem key={val} value={val}>{val}</SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Service Code <span className="text-red-500">*</span></label>
                      <Input value={serviceCode} onChange={(e) => setServiceCode(e.target.value)} placeholder="e.g. SVC-001" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Pricing Unit</label>
                      <Input value={pricingUnit} onChange={(e) => setPricingUnit(e.target.value)} placeholder="e.g. per kg" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Base Price</label>
                      <Input type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Optional" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Transit Time (days)</label>
                      <Input type="number" value={transitDays} onChange={(e) => setTransitDays(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Optional" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Active</label>
                      <div className="flex items-center gap-2">
                        <Switch checked={isActive} onCheckedChange={setIsActive} />
                        <span className="text-sm text-muted-foreground">Enabled</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
                  </div>

                  <ServiceAttributeRenderer
                      serviceTypeId={types.find(t => t.name === (serviceType || resolvedDefaultServiceType))?.id || null}
                      value={attributes}
                      onChange={setAttributes}
                  />

                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={!isAdmin || (isPlatform && !selectedTenantId && !tenantId)}>Save</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 mb-4">
              <Input
                placeholder="Search name, type, code"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all'|'active'|'inactive')}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {displayTypes.map((t) => (
                    <SelectItem key={toCanonicalType(t.name)} value={toCanonicalType(t.name)}>{toCanonicalType(t.name)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isPlatform && (
                <Select value={listTenantFilter} onValueChange={(v) => setListTenantFilter(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tenants</SelectItem>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as 'name'|'type'|'tenant'|'price'|'time'|'status')}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                  {isPlatform && <SelectItem value="tenant">Tenant</SelectItem>}
                  <SelectItem value="price">Base Price</SelectItem>
                  <SelectItem value="time">Transit Days</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortDir} onValueChange={(v) => setSortDir(v as 'asc'|'desc')}>
                <SelectTrigger>
                  <SelectValue placeholder="Order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Asc</SelectItem>
                  <SelectItem value="desc">Desc</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service Name</TableHead>
                  {isPlatform && <TableHead>Tenant</TableHead>}
                  <TableHead>Type</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Base Price</TableHead>
                  <TableHead>Transit Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleServices.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.service_name}</TableCell>
                    {isPlatform && (
                      <TableCell>{tenantNameById[row.tenant_id] || row.tenant_id}</TableCell>
                    )}
                    <TableCell>{row.service_type}</TableCell>
                    <TableCell>{row.service_code || '—'}</TableCell>
                    <TableCell>{row.base_price ?? '—'}</TableCell>
                    <TableCell>{row.transit_time_days ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={row.is_active ? 'default' : 'secondary'}>
                        {row.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openView(row)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Switch checked={row.is_active} onCheckedChange={(v) => handleToggleActive(row, v)} disabled={!isAdmin} />
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)} disabled={!isAdmin}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(row)} disabled={!isAdmin}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {/* Edit dialog */}
        <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) resetEditForm(); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Service</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="general">General Details</TabsTrigger>
                <TabsTrigger value="suppliers">Suppliers & Cost</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4 pt-4">
              {isPlatform ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tenant</label>
                  <Select value={editTenantId} onValueChange={setEditTenantId}>
                    <SelectTrigger>
                      <SelectValue placeholder={tenants.length === 0 ? 'No tenants' : 'Select tenant'} />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No tenants available</div>
                      ) : (
                        tenants.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {editingRow && editTenantId && editTenantId !== editingRow.tenant_id && (
                    <div className="mt-2 space-y-2">
                      <div className="text-xs text-muted-foreground">
                        Changing tenant may orphan existing mappings for this service.
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={editMigrateMappings} onCheckedChange={setEditMigrateMappings} />
                        <span className="text-sm">Migrate mappings to new tenant</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Tenant</label>
                  <div className="text-sm text-muted-foreground">{tenantNameById[editingRow?.tenant_id || ''] || 'Current tenant'}</div>
                </div>
              )}
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Service Name</label>
                <Input value={editServiceName} onChange={(e) => setEditServiceName(e.target.value)} />
              </div>
            </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Service Code <span className="text-red-500">*</span></label>
                  <Input value={editServiceCode} onChange={(e) => setEditServiceCode(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pricing Unit</label>
                  <Input value={editPricingUnit} onChange={(e) => setEditPricingUnit(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Base Price</label>
                  <Input type="number" value={editBasePrice} onChange={(e) => setEditBasePrice(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Transit Time (days)</label>
                  <Input type="number" value={editTransitDays} onChange={(e) => setEditTransitDays(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Active</label>
                  <div className="flex items-center gap-2">
                    <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
                    <span className="text-sm text-muted-foreground">Enabled</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              </div>

              <ServiceAttributeRenderer
                  serviceTypeId={types.find(t => t.name === editServiceType)?.id || null}
                  value={editAttributes}
                  onChange={setEditAttributes}
              />

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => { setEditOpen(false); resetEditForm(); }}>Cancel</Button>
                <Button onClick={handleUpdate} disabled={!isAdmin || (isPlatform && !editTenantId)}>Save</Button>
              </div>
              </TabsContent>

              <TabsContent value="suppliers" className="space-y-4 pt-4">
                {editingRow ? (
                  <ServiceVendorsPanel serviceId={editingRow.id} />
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    Please save the service first to manage suppliers.
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* View Details Dialog */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Service Details</DialogTitle>
              <DialogDescription>
                 {viewRow?.service_name} ({viewRow?.service_type})
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
               <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">Code:</div>
                  <div>{viewRow?.service_code || '—'}</div>
                  <div className="font-medium">Price:</div>
                  <div>{viewRow?.base_price ? `${viewRow.base_price} / ${viewRow.pricing_unit || 'unit'}` : '—'}</div>
                  <div className="font-medium">Transit Time:</div>
                  <div>{viewRow?.transit_time_days ? `${viewRow.transit_time_days} days` : '—'}</div>
                  <div className="font-medium">Tenant:</div>
                  <div>{tenantNameById[viewRow?.tenant_id || ''] || '—'}</div>
               </div>

               <div className="h-[300px]">
                 <ServiceHistoryPanel serviceId={viewRow?.id || ''} />
               </div>

               {Object.keys(viewAttributes).length > 0 || viewRow?.service_type_id || viewRow?.service_type ? (
                 <ServiceAttributeRenderer
                    serviceTypeId={viewRow?.service_type_id || types.find(t => t.name === viewRow?.service_type)?.id || null}
                    value={viewAttributes}
                    onChange={() => {}}
                    readOnly={true}
                 />
               ) : (
                 <div className="text-sm text-muted-foreground italic">No additional attributes</div>
               )}
            </div>
            <DialogFooter>
               <Button onClick={() => setViewOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm tenant change dialog */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Tenant Change</AlertDialogTitle>
              <AlertDialogDescription>
                This service has {mappingsCount} related mapping{mappingsCount === 1 ? '' : 's'}.
                Changing tenant may orphan these mappings unless migrated.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch checked={editMigrateMappings} onCheckedChange={setEditMigrateMappings} />
                <span className="text-sm">Migrate mappings to new tenant</span>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={confirmBusy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => { setConfirmBusy(true); await doSaveWithMigrationIfNeeded(); }}
                disabled={confirmBusy}
              >
                Proceed
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
