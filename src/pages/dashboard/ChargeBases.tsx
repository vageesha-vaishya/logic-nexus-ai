import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableCell, TableBody } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';

export default function ChargeBases() {
  const [items, setItems] = useState<any[]>([]);
  const [newItem, setNewItem] = useState({ name: '', code: '', description: '' });

  const load = async () => {
    const { data } = await (supabase as any).from('charge_bases').select('*').order('name');
    setItems(data ?? []);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newItem.name) return;
    await (supabase as any).from('charge_bases').insert({ ...newItem });
    setNewItem({ name: '', code: '', description: '' });
    load();
  };

  const update = async (id: string, patch: any) => {
    await (supabase as any).from('charge_bases').update(patch).eq('id', id);
    load();
  };

  const remove = async (id: string) => {
    await (supabase as any).from('charge_bases').delete().eq('id', id);
    load();
  };

  return (
    <DashboardLayout>
      <Card>
        <CardHeader><CardTitle>Charge Bases</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Name" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
            <Input placeholder="Code" value={newItem.code} onChange={e => setNewItem({ ...newItem, code: e.target.value })} />
            <Input placeholder="Description" value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} />
            <Button onClick={add}>Add</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Description</TableCell>
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
                  <TableCell>
                    <Button variant="outline" onClick={() => update(it.id, { is_active: !it.is_active })}>
                      {it.is_active ? 'Active' : 'Inactive'}
                    </Button>
                  </TableCell>
                  <TableCell><Button variant="destructive" onClick={() => remove(it.id)}>Delete</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}