import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Pencil } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

type ServiceTypeRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
};

export default function ServiceTypes() {
  const { supabase, context } = useCRM();
  const [types, setTypes] = useState<ServiceTypeRow[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  // Search / filter / sort
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all'|'active'|'inactive'>('all');
  const [sortKey, setSortKey] = useState<'name'|'status'|'description'>('name');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');

  const [editOpen, setEditOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ServiceTypeRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  const isPlatform = context.isPlatformAdmin;

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .order('name');
      if (error) throw error;
      setTypes((data || []) as ServiceTypeRow[]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to fetch service types:', message);
      toast.error('Failed to fetch service types', { description: message });
    }
  };

  const resetForm = () => {
    setName('');
    setCode('');
    setDescription('');
    setIsActive(true);
  };

  const resetEditForm = () => {
    setEditingRow(null);
    setEditName('');
    setEditCode('');
    setEditDescription('');
    setEditIsActive(true);
  };

  const handleCreate = async () => {
    try {
      if (!isPlatform) {
        toast.error('Only platform admins can create service types');
        return;
      }
      if (!name.trim()) {
        toast.error('Type name is required');
        return;
      }
      if (!code.trim()) {
        toast.error('Type code is required');
        return;
      }
      const payload = { 
        name: name.trim(), 
        code: code.trim().toLowerCase(),
        description: description || null, 
        is_active: isActive 
      } as const;
      const { error } = await supabase.from('service_types').insert(payload);
      if (error) throw error;
      toast.success('Service type created');
      setOpen(false);
      resetForm();
      fetchTypes();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Failed to create type', { description: message });
    }
  };

  const handleToggleActive = async (row: ServiceTypeRow, next: boolean) => {
    try {
      if (!isPlatform) {
        toast.error('Only platform admins can update service types');
        return;
      }
      const { error } = await supabase
        .from('service_types')
        .update({ is_active: next })
        .eq('id', row.id);
      if (error) throw error;
      fetchTypes();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Failed to update type', { description: message });
    }
  };

  const handleDelete = async (row: ServiceTypeRow) => {
    try {
      if (!isPlatform) {
        toast.error('Only platform admins can delete service types');
        return;
      }
      const { error } = await supabase
        .from('service_types')
        .delete()
        .eq('id', row.id);
      if (error) throw error;
      toast.success('Service type deleted');
      fetchTypes();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Failed to delete type', { description: message });
    }
  };

  const openEdit = (row: ServiceTypeRow) => {
    setEditingRow(row);
    setEditName(row.name);
    setEditCode(row.code);
    setEditDescription(row.description || '');
    setEditIsActive(row.is_active);
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    try {
      if (!isPlatform) {
        toast.error('Only platform admins can update service types');
        return;
      }
      if (!editingRow) return;
      if (!editName.trim()) {
        toast.error('Type name is required');
        return;
      }
      if (!editCode.trim()) {
        toast.error('Type code is required');
        return;
      }
      const payload = {
        name: editName.trim(),
        code: editCode.trim().toLowerCase(),
        description: editDescription || null,
        is_active: editIsActive,
      } as const;
      const { error } = await supabase
        .from('service_types')
        .update(payload)
        .eq('id', editingRow.id);
      if (error) throw error;
      toast.success('Service type updated');
      setEditOpen(false);
      resetEditForm();
      fetchTypes();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Failed to update type', { description: message });
    }
  };

  const visibleTypes = (() => {
    const term = search.trim().toLowerCase();
    const filtered = types.filter((t) => {
      const matchesSearch = term === ''
        ? true
        : [t.name, t.description || ''].some(v => String(v).toLowerCase().includes(term));
      const matchesStatus = statusFilter === 'all'
        ? true
        : statusFilter === 'active'
          ? t.is_active
          : !t.is_active;
      return matchesSearch && matchesStatus;
    });
    const cmp = (a: ServiceTypeRow, b: ServiceTypeRow) => {
      let av: string | number; let bv: string | number;
      if (sortKey === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (sortKey === 'description') { av = (a.description || '').toLowerCase(); bv = (b.description || '').toLowerCase(); }
      else { av = a.is_active ? 1 : 0; bv = b.is_active ? 1 : 0; }
      const base = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? base : -base;
    };
    return filtered.sort(cmp);
  })();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Service Types</h1>
          <p className="text-muted-foreground">Define and manage allowed service type values for services and mappings.</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Types</CardTitle>
              <CardDescription>Platform-wide allowed service types.</CardDescription>
            </div>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button disabled={!isPlatform}>
                  <Plus className="mr-2 h-4 w-4" /> Add Type
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Service Type</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ocean Freight" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Code</label>
                    <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. ocean" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Active</label>
                    <div className="flex items-center gap-2">
                      <Switch checked={isActive} onCheckedChange={setIsActive} />
                      <span className="text-sm text-muted-foreground">Enabled</span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={!isPlatform}>Save</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
              <Input
                placeholder="Search name or description"
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
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as 'name'|'description'|'status')}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="description">Description</SelectItem>
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
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {visibleTypes.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="font-mono text-sm">{row.code}</TableCell>
                  <TableCell>{row.description || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={row.is_active ? 'default' : 'secondary'}>
                      {row.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={row.is_active} onCheckedChange={(v) => handleToggleActive(row, v)} disabled={!isPlatform} />
                      <Button variant="ghost" size="icon" onClick={() => openEdit(row)} disabled={!isPlatform}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(row)} disabled={!isPlatform}>
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
            <DialogTitle>Edit Service Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Code</label>
              <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Active</label>
              <div className="flex items-center gap-2">
                <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
                <span className="text-sm text-muted-foreground">Enabled</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setEditOpen(false); resetEditForm(); }}>Cancel</Button>
              <Button onClick={handleUpdate} disabled={!isPlatform}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  </DashboardLayout>
  );
}
