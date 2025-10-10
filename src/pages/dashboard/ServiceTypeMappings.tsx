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
import { Trash2, Plus, Pencil } from 'lucide-react';
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
  const [tenants, setTenants] = useState<{ id: string; name?: string }[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [newType, setNewType] = useState<string>('');
  const [newServiceId, setNewServiceId] = useState<string>('');
  const [newIsDefault, setNewIsDefault] = useState<boolean>(false);
  const [newPriority, setNewPriority] = useState<number>(0);
  const [newConditions, setNewConditions] = useState<string>('{}');
  const [newIsActive, setNewIsActive] = useState<boolean>(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<MappingRow | null>(null);
  const [editTenantId, setEditTenantId] = useState<string>('');
  const [editType, setEditType] = useState<string>('');
  const [editServiceId, setEditServiceId] = useState<string>('');
  const [editIsDefault, setEditIsDefault] = useState<boolean>(false);
  const [editPriority, setEditPriority] = useState<number>(0);
  const [editConditions, setEditConditions] = useState<string>('{}');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  // Search / filter / sort for listing
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all'|'active'|'inactive'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [listTenantFilter, setListTenantFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<'priority'|'type'|'service'|'status'|'default'>('priority');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');

  // Map friendly labels to canonical codes used by services.service_type, else use the label.
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
  const selectTypeOptions = useMemo(() => {
    const names = (typeOptions.length > 0 ? typeOptions.map(t => t.name) : Array.from(FALLBACK_SERVICE_TYPES));
    const seen: Record<string,boolean> = {};
    const opts = names.map((label) => {
      const value = toCanonicalType(label);
      // Deduplicate by value to avoid multiple synonyms
      if (seen[value]) return null;
      seen[value] = true;
      return { value, label };
    }).filter(Boolean) as { value: string; label: string }[];
    return opts.length > 0 ? opts : Array.from(FALLBACK_SERVICE_TYPES).map(v => ({ value: v, label: v }));
  }, [typeOptions]);

  const isPlatform = context.isPlatformAdmin;
  const tenantId = context.tenantId || null;

  useEffect(() => {
    if (isPlatform || tenantId) {
      fetchServices();
      fetchMappings();
    }
    fetchTypes();
    if (isPlatform) {
      fetchTenants();
    }
  }, [isPlatform, tenantId]);

  const fetchServices = async () => {
    try {
      let query = supabase
        .from('services')
        .select('id, service_name, service_type, tenant_id, is_active');
      if (!isPlatform) {
        query = query.eq('tenant_id', tenantId as string);
      } else if (selectedTenantId) {
        // Scope to selected tenant for admins to reduce payload and ensure correct filtering
        query = query.eq('tenant_id', selectedTenantId);
      }
      const { data, error } = await query.order('service_name');
      if (error) throw error;
      setServices(data || []);
    } catch (err: any) {
      console.error('Failed to fetch services:', err?.message || err);
      toast.error('Failed to fetch services', { description: err?.message });
    }
  };

  useEffect(() => {
    // When platform admin changes selected tenant, refetch services
    if (isPlatform && open) {
      fetchServices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTenantId]);

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

  const fetchTenants = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('tenants')
        .select('id, name')
        .order('name');
      if (error) throw error;
      setTenants((data || []) as any);
    } catch (err: any) {
      console.error('Failed to fetch tenants:', err?.message || err);
      toast.error('Failed to fetch tenants', { description: err?.message });
    }
  };

  const serviceById = useMemo(() => {
    const map: Record<string, any> = {};
    services.forEach((s: any) => { map[String(s.id)] = s; });
    return map;
  }, [services]);
  const tenantNameById = useMemo(() => {
    const map: Record<string, string> = {};
    tenants.forEach((t) => { map[String(t.id)] = String(t.name || t.id?.slice(0,8)); });
    return map;
  }, [tenants]);

  const visibleMappings = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (mappings || []).filter((m) => {
      const svc = serviceById[String(m.service_id)];
      const name = String(svc?.service_name || '');
      const matchesSearch = term === ''
        ? true
        : [name, m.service_type].some(v => String(v).toLowerCase().includes(term));
      const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'active' ? m.is_active : !m.is_active;
      const matchesType = typeFilter === 'all' ? true : m.service_type === typeFilter;
      const matchesTenant = !isPlatform ? true : (listTenantFilter === 'all' ? true : m.tenant_id === listTenantFilter);
      return matchesSearch && matchesStatus && matchesType && matchesTenant;
    });
    const cmp = (a: any, b: any) => {
      let av: any; let bv: any;
      if (sortKey === 'priority') { av = a.priority; bv = b.priority; }
      else if (sortKey === 'type') { av = String(a.service_type).toLowerCase(); bv = String(b.service_type).toLowerCase(); }
      else if (sortKey === 'service') {
        av = String(serviceById[String(a.service_id)]?.service_name || '').toLowerCase();
        bv = String(serviceById[String(b.service_id)]?.service_name || '').toLowerCase();
      } else if (sortKey === 'status') { av = a.is_active ? 1 : 0; bv = b.is_active ? 1 : 0; }
      else { av = a.is_default ? 1 : 0; bv = b.is_default ? 1 : 0; }
      const base = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? base : -base;
    };
    return filtered.sort(cmp);
  }, [mappings, serviceById, search, statusFilter, typeFilter, listTenantFilter, sortKey, sortDir, isPlatform]);

  // Candidate canonical service types to show for a selected friendly type label
  const candidateTypesFor = useMemo(() => {
    const map: Record<string, string[]> = {
      'freight forwarding': ['ocean','air','trucking','courier','railway_transport'],
      'customs clearance': ['ocean','air','trucking','courier','railway_transport'],
      'inland_waterway': ['ocean','trucking','railway_transport'],
      'inland waterway': ['ocean','trucking','railway_transport'],
      'express_delivery': ['courier','air'],
      'express delivery': ['courier','air'],
      'warehouse': ['moving','trucking'],
      'warehousing': ['moving','trucking'],
      'distribution': ['trucking','courier'],
      'last mile': ['courier','trucking'],
    };
    return map;
  }, []);

  const resolveCandidateTypes = (labelOrValue: string) => {
    const key = String(labelOrValue || '').trim().toLowerCase();
    const direct = candidateTypesFor[key];
    if (direct && direct.length > 0) return direct;
    const canonical = toCanonicalType(labelOrValue);
    if (canonical) return [canonical];
    // Fallback to all common modes
    return Array.from(FALLBACK_SERVICE_TYPES);
  };

  const filteredServicesForType = useMemo(() => {
    if (!newType) return [];
    const candidates = resolveCandidateTypes(newType);
    const byType = services.filter((s: any) => candidates.includes(String(s.service_type)));
    if (isPlatform) {
      // When platform admin, scope by selected tenant if provided
      if (selectedTenantId) return byType.filter((s: any) => String(s.tenant_id) === String(selectedTenantId));
      // No tenant selected: do not show services to force tenant scoping
      return [];
    }
    return byType;
  }, [services, newType, isPlatform, selectedTenantId]);

  const filteredEditServicesForType = useMemo(() => {
    if (!editType) return [];
    const candidates = resolveCandidateTypes(editType);
    const byType = services.filter((s: any) => candidates.includes(String(s.service_type)));
    if (isPlatform) {
      if (editTenantId) return byType.filter((s: any) => String(s.tenant_id) === String(editTenantId));
      return [];
    }
    return byType;
  }, [services, editType, isPlatform, editTenantId]);

  const resetForm = () => {
    setNewType('');
    setNewServiceId('');
    setNewIsDefault(false);
    setNewPriority(0);
    setNewConditions('{}');
    setNewIsActive(true);
    if (isPlatform) setSelectedTenantId('');
  };

  const resetEditForm = () => {
    setEditingRow(null);
    setEditTenantId('');
    setEditType('');
    setEditServiceId('');
    setEditIsDefault(false);
    setEditPriority(0);
    setEditConditions('{}');
    setEditIsActive(true);
  };

  const handleCreate = async () => {
    try {
      const tId = isPlatform ? selectedTenantId : (tenantId as string);
      if (!tId) {
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
        tenant_id: tId,
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

  const openEdit = (row: MappingRow) => {
    setEditingRow(row);
    setEditTenantId(String(row.tenant_id));
    setEditType(String(row.service_type));
    setEditServiceId(String(row.service_id));
    setEditIsDefault(row.is_default);
    setEditPriority(Number(row.priority) || 0);
    setEditConditions(JSON.stringify(row.conditions || {}));
    setEditIsActive(row.is_active);
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    try {
      if (!editingRow) return;
      if (!editType || !editServiceId) {
        toast.error('Please select type and service');
        return;
      }
      let conditionsObj: any = {};
      try {
        conditionsObj = JSON.parse(editConditions || '{}');
      } catch (jsonErr) {
        toast.error('Conditions must be valid JSON');
        return;
      }
      const payload = {
        service_type: editType,
        service_id: editServiceId,
        is_default: editIsDefault,
        priority: editPriority,
        conditions: conditionsObj,
        is_active: editIsActive,
      } as any;
      const { error } = await (supabase as any)
        .from('service_type_mappings')
        .update(payload)
        .eq('id', editingRow.id);
      if (error) throw error;
      toast.success('Mapping updated');
      setEditOpen(false);
      resetEditForm();
      fetchMappings();
    } catch (err: any) {
      const msg = err?.message || String(err);
      toast.error('Failed to update mapping', { description: msg });
      fetchMappings();
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
                  {isPlatform && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tenant</label>
                      <Select value={selectedTenantId} onValueChange={(v) => { setSelectedTenantId(v); setNewServiceId(''); }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a tenant" />
                        </SelectTrigger>
                        <SelectContent>
                          {tenants.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">No tenants found</div>
                          ) : (
                            tenants.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                <div className="flex items-center gap-2">
                                  <span>{t.name || String(t.id).slice(0,8)}</span>
                                  <span className="text-xs text-muted-foreground">{String(t.id).slice(0,8)}</span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Service Type</label>
                      <Select value={newType} onValueChange={(v) => { setNewType(v); setNewServiceId(''); }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a type" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectTypeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Service</label>
                      <Select value={newServiceId} onValueChange={setNewServiceId} disabled={!newType || (isPlatform && !selectedTenantId)}>
                        <SelectTrigger>
                          <SelectValue placeholder={!newType ? 'Choose type first' : (isPlatform && !selectedTenantId ? 'Choose tenant first' : 'Select service')} />
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
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 mb-4">
              <Input
                placeholder="Search service or type"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
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
                  {selectTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
                      <SelectItem key={t.id} value={t.id}>{t.name || t.id.slice(0,8)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="default">Default</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortDir} onValueChange={(v) => setSortDir(v as any)}>
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
                {visibleMappings.map((row) => {
                  const svc = serviceById[String(row.service_id)];
                  return (
                    <TableRow key={row.id}>
                      {isPlatform && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{tenantNameById[row.tenant_id] || row.tenant_id?.slice(0,8)}</span>
                            <span className="text-xs text-muted-foreground">{String(row.tenant_id || '').slice(0,8)}</span>
                          </div>
                        </TableCell>
                      )}
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
                          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
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
        {/* Edit dialog */}
        <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) resetEditForm(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Mapping</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {isPlatform && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tenant</label>
                  <div className="flex items-center gap-2">
                    <span>{tenantNameById[editTenantId] || editTenantId}</span>
                    <span className="text-xs text-muted-foreground">{String(editTenantId || '').slice(0,8)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Tenant is fixed for existing mapping</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Service Type</label>
                  <Select value={editType} onValueChange={(v) => { setEditType(v); setEditServiceId(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectTypeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Service</label>
                  <Select value={editServiceId} onValueChange={setEditServiceId} disabled={!editType || (isPlatform && !editTenantId)}>
                    <SelectTrigger>
                      <SelectValue placeholder={!editType ? 'Choose type first' : (isPlatform && !editTenantId ? 'Tenant required' : 'Select service')} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredEditServicesForType.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No services for selected type</div>
                      ) : (
                        filteredEditServicesForType.map((s: any) => (
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
                    <Switch checked={editIsDefault} onCheckedChange={setEditIsDefault} />
                    <span className="text-sm text-muted-foreground">One default per type</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Input type="number" value={editPriority} onChange={(e) => setEditPriority(Number(e.target.value))} />
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
                <label className="text-sm font-medium">Conditions (JSON)</label>
                <Input value={editConditions} onChange={(e) => setEditConditions(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => { setEditOpen(false); resetEditForm(); }}>Cancel</Button>
                <Button onClick={handleUpdate}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}