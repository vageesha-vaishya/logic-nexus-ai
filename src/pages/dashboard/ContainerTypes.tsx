import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableCell, TableBody } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useCRM } from '@/hooks/useCRM';
import type { Database } from '@/integrations/supabase/types';

export default function ContainerTypes() {
  type ContainerType = Database['public']['Tables']['container_types']['Row'];
  const { scopedDb } = useCRM();
  const [items, setItems] = useState<ContainerType[]>([]);
  const [newItem, setNewItem] = useState<{ 
    name: string; 
    code: string;
    description: string;
    requires_temperature: boolean;
    requires_ventilation: boolean;
    requires_power: boolean;
  }>({ 
    name: '', 
    code: '',
    description: '',
    requires_temperature: false,
    requires_ventilation: false,
    requires_power: false
  });

  const load = async () => {
    const { data } = await scopedDb.from('container_types').select('*').order('name');
    setItems((data ?? []) as ContainerType[]);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newItem.name) return;
    await scopedDb.from('container_types').insert(newItem);
    setNewItem({ 
      name: '', 
      code: '',
      description: '',
      requires_temperature: false,
      requires_ventilation: false,
      requires_power: false
    });
    load();
  };

  const update = async (id: string, patch: Partial<ContainerType>) => {
    // Cast to any to bypass strict type checking
    const isUUID = (v: any) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    if (!isUUID(id)) return;
    await scopedDb.from('container_types').update(patch as any).eq('id', id);
    load();
  };

  const remove = async (id: string) => {
    const isUUID = (v: any) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    if (!isUUID(id)) return;
    await scopedDb.from('container_types').delete().eq('id', id);
    load();
  };

  return (
    <DashboardLayout>
      <Card>
        <CardHeader><CardTitle>Container Types</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end border p-4 rounded-lg bg-muted/20">
            <div className="space-y-2 lg:col-span-1">
              <Label>Name</Label>
              <Input placeholder="Refrigerated" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label>Code</Label>
              <Input placeholder="RF" value={newItem.code} onChange={e => setNewItem({ ...newItem, code: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2 items-center justify-center">
              <Label className="text-xs">Temp</Label>
              <Switch checked={newItem.requires_temperature} onCheckedChange={c => setNewItem({ ...newItem, requires_temperature: c })} />
            </div>
            <div className="flex flex-col gap-2 items-center justify-center">
              <Label className="text-xs">Vent</Label>
              <Switch checked={newItem.requires_ventilation} onCheckedChange={c => setNewItem({ ...newItem, requires_ventilation: c })} />
            </div>
            <div className="flex flex-col gap-2 items-center justify-center">
              <Label className="text-xs">Power</Label>
              <Switch checked={newItem.requires_power} onCheckedChange={c => setNewItem({ ...newItem, requires_power: c })} />
            </div>
            <Button onClick={add}>Add Type</Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Code</TableCell>
                <TableCell className="text-center">Temp</TableCell>
                <TableCell className="text-center">Vent</TableCell>
                <TableCell className="text-center">Power</TableCell>
                <TableCell>Active</TableCell>
                <TableCell />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(it => (
                <TableRow key={it.id}>
                  <TableCell><Input value={it.name ?? ''} onChange={e => update(it.id, { name: e.target.value })} /></TableCell>
                  <TableCell><Input value={it.code ?? ''} onChange={e => update(it.id, { code: e.target.value })} /></TableCell>
                  <TableCell><Input value={it.description ?? ''} onChange={e => update(it.id, { description: e.target.value })} /></TableCell>
                  <TableCell className="text-center">
                    <Switch checked={it.requires_temperature ?? false} onCheckedChange={c => update(it.id, { requires_temperature: c })} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={it.requires_ventilation ?? false} onCheckedChange={c => update(it.id, { requires_ventilation: c })} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={it.requires_power ?? false} onCheckedChange={c => update(it.id, { requires_power: c })} />
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => update(it.id, { is_active: !it.is_active })}>
                      {it.is_active ? 'Active' : 'Inactive'}
                    </Button>
                  </TableCell>
                  <TableCell><Button variant="destructive" size="sm" onClick={() => remove(it.id)}>Delete</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
