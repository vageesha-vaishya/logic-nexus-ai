import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus } from 'lucide-react';
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
  const [open, setOpen] = useState(false);
  const [serviceName, setServiceName] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [serviceCode, setServiceCode] = useState('');
  const [description, setDescription] = useState('');
  const [pricingUnit, setPricingUnit] = useState('');
  const [basePrice, setBasePrice] = useState<number | ''>('');
  const [transitDays, setTransitDays] = useState<number | ''>('');
  const [isActive, setIsActive] = useState(true);

  const isTenantAdmin = context.isTenantAdmin;
  const isPlatform = context.isPlatformAdmin;
  const tenantId = context.tenantId || null;

  useEffect(() => {
    fetchTypes();
    fetchServices();
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

  const handleCreate = async () => {
    try {
      if (!tenantId) {
        toast.error('No tenant context found');
        return;
      }
      if (!isTenantAdmin) {
        toast.error('Only tenant admins can create services');
        return;
      }
      if (!serviceName.trim() || !serviceType) {
        toast.error('Service name and type are required');
        return;
      }
      const payload: any = {
        tenant_id: tenantId,
        service_name: serviceName.trim(),
        service_type: serviceType,
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
      if (!isTenantAdmin) {
        toast.error('Only tenant admins can update services');
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
      if (!isTenantAdmin) {
        toast.error('Only tenant admins can delete services');
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

  const activeTypes = useMemo(() => types.filter(t => t.is_active), [types]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Services</h1>
          <p className="text-muted-foreground">Create and manage tenant services with a selected service type.</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Services</CardTitle>
              <CardDescription>Tenant-scoped services available for quotes and mappings.</CardDescription>
            </div>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button disabled={!isTenantAdmin}>
                  <Plus className="mr-2 h-4 w-4" /> Add Service
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Service</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Service Name</label>
                      <Input value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="e.g. Ocean Standard" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Service Type</label>
                      <Select value={serviceType} onValueChange={setServiceType}>
                        <SelectTrigger>
                          <SelectValue placeholder={activeTypes.length === 0 ? 'No active types' : 'Select type'} />
                        </SelectTrigger>
                        <SelectContent>
                          {activeTypes.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">No active service types</div>
                          ) : (
                            activeTypes.map((t) => (
                              <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
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
                    <Button onClick={handleCreate} disabled={!isTenantAdmin}>Save</Button>
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
                        <Switch checked={row.is_active} onCheckedChange={(v) => handleToggleActive(row, v)} disabled={!isTenantAdmin} />
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(row)} disabled={!isTenantAdmin}>
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
      </div>
    </DashboardLayout>
  );
}