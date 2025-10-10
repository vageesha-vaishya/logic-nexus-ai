import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Pencil } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

type ServiceRow = {
  id: string;
  tenant_id: string;
  service_name: string;
  service_type: string;
  service_code: string | null;
  description: string | null;
  pricing_unit: string | null;
  base_price: number | null;
  transit_time_days: number | null;
  is_active: boolean;
};

export default function Services() {
  const { supabase, context } = useCRM();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [types, setTypes] = useState<{ name: string; is_active: boolean }[]>([]);
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mappingsCount, setMappingsCount] = useState<number>(0);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const STRICT_DISALLOW_TENANT_CHANGE_WITH_MAPPINGS = false;

  const isTenantAdmin = context.isTenantAdmin;
  const isPlatform = context.isPlatformAdmin;
  const isAdmin = isTenantAdmin || isPlatform;
  const tenantId = context.tenantId || null;

  useEffect(() => {
    fetchTypes();
    fetchServices();
    if (isPlatform) fetchTenants();
  }, [tenantId, isPlatform]);

  const fetchTypes = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('service_types')
        .select('name, is_active')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setTypes((data || []) as any);
    } catch (err: any) {
      console.error('Failed to fetch service types:', err?.message || err);
    }
  };

  const fetchTenants = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('tenants')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setTenants((data || []) as any);
    } catch (err: any) {
      console.error('Failed to fetch tenants:', err?.message || err);
      toast.error('Failed to fetch tenants', { description: err?.message });
    }
  };

  const fetchServices = async () => {
    try {
      // Platform admins can view all services across tenants; others are tenant-scoped
      let query = supabase
        .from('services')
        .select('id, tenant_id, service_name, service_type, service_code, description, pricing_unit, base_price, transit_time_days, is_active')
        .order('service_name');

      if (!isPlatform) {
        if (!tenantId) return; // non-admin without tenant context: nothing to show
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setServices((data || []) as any);
    } catch (err: any) {
      console.error('Failed to fetch services:', err?.message || err);
      toast.error('Failed to fetch services', { description: err?.message });
    }
  };

  const resetForm = () => {
    setServiceName('');
    setServiceType('');
    setServiceCode('');
    setDescription('');
    setPricingUnit('');
    setBasePrice('');
    setTransitDays('');
    setIsActive(true);
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
      const chosenType = resolvedDefaultServiceType;
      if (!chosenType) {
        toast.error('No active service types available', { description: 'Activate at least one type under Service Types.' });
        return;
      }
      const payload: any = {
        tenant_id: targetTenantId,
        service_name: serviceName.trim(),
        service_type: chosenType,
        service_code: serviceCode || null,
        description: description || null,
        pricing_unit: pricingUnit || null,
        base_price: basePrice === '' ? null : Number(basePrice),
        transit_time_days: transitDays === '' ? null : Number(transitDays),
        is_active: isActive,
      };
      const { error } = await supabase.from('services').insert([payload]);
      if (error) throw error;
      toast.success('Service created');
      setOpen(false);
      resetForm();
      fetchServices();
    } catch (err: any) {
      toast.error('Failed to create service', { description: err?.message });
    }
  };

  const handleToggleActive = async (row: ServiceRow, next: boolean) => {
    try {
      if (!isAdmin) {
        toast.error('Only admins can update services');
        return;
      }
      const { error } = await supabase
        .from('services')
        .update({ is_active: next })
        .eq('id', row.id);
      if (error) throw error;
      fetchServices();
    } catch (err: any) {
      toast.error('Failed to update service', { description: err?.message });
    }
  };

  const handleDelete = async (row: ServiceRow) => {
    try {
      if (!isAdmin) {
        toast.error('Only admins can delete services');
        return;
      }
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', row.id);
      if (error) throw error;
      toast.success('Service deleted');
      fetchServices();
    } catch (err: any) {
      toast.error('Failed to delete service', { description: err?.message });
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
  };

  const doSaveWithMigrationIfNeeded = async () => {
    try {
      if (!isAdmin || !editingRow) return;
      const payload: any = {
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
          const { error: migError } = await (supabase as any)
            .from('service_type_mappings')
            .update({ tenant_id: editTenantId })
            .eq('service_id', editingRow.id)
            .eq('tenant_id', editingRow.tenant_id);
          if (migError) throw migError;
        }
        payload.tenant_id = editTenantId;
      }
      const { error } = await supabase
        .from('services')
        .update(payload)
        .eq('id', editingRow.id);
      if (error) throw error;
      toast.success('Service updated');
      setEditOpen(false);
      setConfirmOpen(false);
      resetEditForm();
      fetchServices();
    } catch (err: any) {
      toast.error('Failed to update service', { description: err?.message });
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
        const { count, error: countError } = await (supabase as any)
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
    } catch (err: any) {
      toast.error('Failed to update service', { description: err?.message });
    }
  };

  const activeTypes = useMemo(() => types.filter(t => t.is_active), [types]);
  const displayTypes = useMemo(() => {
    if (activeTypes.length > 0) return activeTypes;
    // Fallback to common types if none active are found in DB
    const FALLBACK = ['ocean','air','trucking','courier','moving','railway_transport'];
    return FALLBACK.map((name) => ({ name, is_active: true }));
  }, [activeTypes]);
  const resolvedDefaultServiceType = useMemo(() => {
    return String(displayTypes[0]?.name || '');
  }, [displayTypes]);
  const tenantNameById = useMemo(() => Object.fromEntries(tenants.map(t => [t.id, t.name])), [tenants]);

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
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Service Code</label>
                      <Input value={serviceCode} onChange={(e) => setServiceCode(e.target.value)} placeholder="Optional" />
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
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={!isAdmin || (isPlatform && !selectedTenantId && !tenantId)}>Save</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
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
                {services.map((row) => (
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Service</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
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
                  <label className="text-sm font-medium">Service Code</label>
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
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => { setEditOpen(false); resetEditForm(); }}>Cancel</Button>
                <Button onClick={handleUpdate} disabled={!isAdmin || (isPlatform && !editTenantId)}>Save</Button>
              </div>
            </div>
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