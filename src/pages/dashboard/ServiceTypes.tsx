import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

type ServiceTypeRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

export default function ServiceTypes() {
  const { supabase, context } = useCRM();
  const [types, setTypes] = useState<ServiceTypeRow[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const isPlatform = context.isPlatformAdmin;

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('service_types')
        .select('*')
        .order('name');
      if (error) throw error;
      setTypes((data || []) as any);
    } catch (err: any) {
      console.error('Failed to fetch service types:', err?.message || err);
      toast.error('Failed to fetch service types', { description: err?.message });
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setIsActive(true);
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
      const payload = { name: name.trim(), description: description || null, is_active: isActive } as any;
      const { error } = await (supabase as any).from('service_types').insert([payload]);
      if (error) throw error;
      toast.success('Service type created');
      setOpen(false);
      resetForm();
      fetchTypes();
    } catch (err: any) {
      toast.error('Failed to create type', { description: err?.message });
    }
  };

  const handleToggleActive = async (row: ServiceTypeRow, next: boolean) => {
    try {
      if (!isPlatform) {
        toast.error('Only platform admins can update service types');
        return;
      }
      const { error } = await (supabase as any)
        .from('service_types')
        .update({ is_active: next })
        .eq('id', row.id);
      if (error) throw error;
      fetchTypes();
    } catch (err: any) {
      toast.error('Failed to update type', { description: err?.message });
    }
  };

  const handleDelete = async (row: ServiceTypeRow) => {
    try {
      if (!isPlatform) {
        toast.error('Only platform admins can delete service types');
        return;
      }
      const { error } = await (supabase as any)
        .from('service_types')
        .delete()
        .eq('id', row.id);
      if (error) throw error;
      toast.success('Service type deleted');
      fetchTypes();
    } catch (err: any) {
      toast.error('Failed to delete type', { description: err?.message });
    }
  };

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
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. inland_waterway" />
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.description || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={row.is_active ? 'default' : 'secondary'}>
                        {row.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={row.is_active} onCheckedChange={(v) => handleToggleActive(row, v)} disabled={!isPlatform} />
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
      </div>
    </DashboardLayout>
  );
}