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

type MappingRow = {
  id: string;
  tenant_id: string;
  service_type: 'ocean' | 'air' | 'trucking' | 'courier' | 'moving' | 'railway_transport' | string;
  service_id: string;
  is_default: boolean;
  priority: number;
  conditions: Record<string, any> | null;
  is_active: boolean;
};

const FALLBACK_SERVICE_TYPES = ['ocean', 'air', 'trucking', 'courier', 'moving', 'railway_transport'] as const;

export default function ServiceTypeMappings() {
  const { supabase, context } = useCRM();
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [typeOptions, setTypeOptions] = useState<{ name: string; is_active: boolean }[]>([]);
  const [open, setOpen] = useState(false);
  const [newType, setNewType] = useState<string>('');
  const [newServiceId, setNewServiceId] = useState<string>('');
  const [newIsDefault, setNewIsDefault] = useState<boolean>(false);
  const [newPriority, setNewPriority] = useState<number>(0);
  const [newConditions, setNewConditions] = useState<string>('{}');
  const [newIsActive, setNewIsActive] = useState<boolean>(true);

  const isPlatform = context.isPlatformAdmin;
  const tenantId = context.tenantId || null;

  useEffect(() => {
    if (isPlatform || tenantId) {
      fetchServices();
      fetchMappings();
    }
    fetchTypes();
  }, [isPlatform, tenantId]);

  const fetchServices = async () => {
    try {
      let query = supabase
        .from('services')
        .select('id, service_name, service_type, tenant_id, is_active');
      if (!isPlatform) query = query.eq('tenant_id', tenantId as string);
      const { data, error } = await query.order('service_name');
      if (error) throw error;
      setServices(data || []);
    } catch (err: any) {
      console.error('Failed to fetch services:', err?.message || err);
      toast.error('Failed to fetch services', { description: err?.message });
    }
  };

  const fetchMappings = async () => {
    try {
      let query = (supabase as any)
        .from('service_type_mappings')
        .select('*');
      if (!isPlatform) query = query.eq('tenant_id', tenantId as string);
      const { data, error } = await query.order('service_type').order('priority', { ascending: false });
      if (error) throw error;
      const rows = Array.isArray(data) ? (data as any) : [];
      setMappings(rows as unknown as MappingRow[]);
    } catch (err: any) {
      console.error('Failed to fetch mappings:', err?.message || err);
      toast.error('Failed to fetch mappings', { description: err?.message });
    }
  };

  const fetchTypes = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('service_types')
        .select('name, is_active')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setTypeOptions((data || []) as any);
    } catch (err: any) {
      console.error('Failed to fetch service types:', err?.message || err);
    }
  };

  const serviceById = useMemo(() => {
    const map: Record<string, any> = {};
    services.forEach((s: any) => { map[String(s.id)] = s; });
    return map;
  }, [services]);

  const filteredServicesForType = useMemo(() => {
    if (!newType) return [];
    return services.filter((s: any) => String(s.service_type) === String(newType));
  }, [services, newType]);

  const resetForm = () => {
    setNewType('');
    setNewServiceId('');
    setNewIsDefault(false);
    setNewPriority(0);
    setNewConditions('{}');
    setNewIsActive(true);
  };

  const handleCreate = async () => {
    try {
      const tId = tenantId;
      if (!isPlatform && !tId) {
        toast.error('No tenant context found');
        return;
      }
      if (!newType || !newServiceId) {
        toast.error('Please select type and service');
        return;
      }
      let conditionsObj: any = {};
      try {
        conditionsObj = JSON.parse(newConditions || '{}');
      } catch (jsonErr) {
        toast.error('Conditions must be valid JSON');
        return;
      }
      const payload = {
        tenant_id: tId as string,
        service_type: newType,
        service_id: newServiceId,
        is_default: newIsDefault,
        priority: newPriority,
        conditions: conditionsObj,
        is_active: newIsActive,
      } as any;
      const { error } = await (supabase as any).from('service_type_mappings').insert([payload]);
      if (error) throw error;
      toast.success('Mapping created');
      setOpen(false);
      resetForm();
      fetchMappings();
    } catch (err: any) {
      console.error('Failed to create mapping:', err?.message || err);
      toast.error('Failed to create mapping', { description: err?.message });
    }
  };

  const handleToggleDefault = async (row: MappingRow, next: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from('service_type_mappings')
        .update({ is_default: next })
        .eq('id', row.id);
      if (error) throw error;
      fetchMappings();
    } catch (err: any) {
      const msg = err?.message || String(err);
      toast.error('Failed to update default', { description: msg });
      // Unique default constraint may fail; refresh to reflect current state
      fetchMappings();
    }
  };

  const handleToggleActive = async (row: MappingRow, next: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from('service_type_mappings')
        .update({ is_active: next })
        .eq('id', row.id);
      if (error) throw error;
      fetchMappings();
    } catch (err: any) {
      toast.error('Failed to update status', { description: err?.message });
    }
  };

  const handleDelete = async (row: MappingRow) => {
    try {
      const { error } = await (supabase as any)
        .from('service_type_mappings')
        .delete()
        .eq('id', row.id);
      if (error) throw error;
      toast.success('Mapping deleted');
      fetchMappings();
    } catch (err: any) {
      toast.error('Failed to delete mapping', { description: err?.message });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Service Type Mappings</h1>
          <p className="text-muted-foreground">Configure which services are eligible for each service type and set defaults.</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Mappings</CardTitle>
              <CardDescription>Tenant-scoped mapping rules for service selection.</CardDescription>
            </div>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Add Mapping
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Mapping</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Service Type</label>
                      <Select value={newType} onValueChange={(v) => { setNewType(v); setNewServiceId(''); }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a type" />
                        </SelectTrigger>
                        <SelectContent>
                          {(typeOptions.length > 0 ? typeOptions.map(t => t.name) : FALLBACK_SERVICE_TYPES).map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Service</label>
                      <Select value={newServiceId} onValueChange={setNewServiceId} disabled={!newType}>
                        <SelectTrigger>
                          <SelectValue placeholder={!newType ? 'Choose type first' : 'Select service'} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredServicesForType.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">No services for selected type</div>
                          ) : (
                            filteredServicesForType.map((s: any) => (
                              <SelectItem key={String(s.id)} value={String(s.id)}>
                                {s.service_name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Default for Type</label>
                      <div className="flex items-center gap-2">
                        <Switch checked={newIsDefault} onCheckedChange={setNewIsDefault} />
                        <span className="text-sm text-muted-foreground">Mark as default</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Priority</label>
                      <Input type="number" value={newPriority} onChange={(e) => setNewPriority(Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Active</label>
                      <div className="flex items-center gap-2">
                        <Switch checked={newIsActive} onCheckedChange={setNewIsActive} />
                        <span className="text-sm text-muted-foreground">Enabled</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Conditions (JSON)</label>
                    <Input value={newConditions} onChange={(e) => setNewConditions(e.target.value)} placeholder="{}" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
                    <Button onClick={handleCreate}>Save</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  {isPlatform && <TableHead>Tenant</TableHead>}
                  <TableHead>Service Type</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((row) => {
                  const svc = serviceById[String(row.service_id)];
                  return (
                    <TableRow key={row.id}>
                      {isPlatform && <TableCell className="text-xs text-muted-foreground">{row.tenant_id?.slice(0,8)}</TableCell>}
                      <TableCell className="font-medium">{row.service_type}</TableCell>
                      <TableCell>{svc?.service_name || row.service_id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={row.is_default} onCheckedChange={(v) => handleToggleDefault(row, v)} />
                          <span className="text-xs text-muted-foreground">One default per type</span>
                        </div>
                      </TableCell>
                      <TableCell>{row.priority}</TableCell>
                      <TableCell>
                        <Badge variant={row.is_active ? 'default' : 'secondary'}>
                          {row.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={row.is_active} onCheckedChange={(v) => handleToggleActive(row, v)} />
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(row)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}