import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableCell, TableBody } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';

export default function Currencies() {
  const [items, setItems] = useState<any[]>([]);
  const [newItem, setNewItem] = useState({ code: '', name: '', symbol: '' });

  const load = async () => {
    const { data } = await supabase.from('currencies').select('*').order('code');
    setItems(data ?? []);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newItem.code) return;
    await supabase.from('currencies').insert({ ...newItem });
    setNewItem({ code: '', name: '', symbol: '' });
    load();
  };

  const update = async (id: string, patch: any) => {
    await supabase.from('currencies').update(patch).eq('id', id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from('currencies').delete().eq('id', id);
    load();
  };

  return (
    <DashboardLayout>
      <Card>
        <CardHeader><CardTitle>Currencies</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Code" value={newItem.code} onChange={e => setNewItem({ ...newItem, code: e.target.value })} />
            <Input placeholder="Name" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
            <Input placeholder="Symbol" value={newItem.symbol} onChange={e => setNewItem({ ...newItem, symbol: e.target.value })} />
            <Button onClick={add}>Add</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Symbol</TableCell>
                <TableCell>Active</TableCell>
                <TableCell />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(it => (
                <TableRow key={it.id}>
                  <TableCell><Input value={it.code ?? ''} onChange={e => update(it.id, { code: e.target.value })} /></TableCell>
                  <TableCell><Input value={it.name ?? ''} onChange={e => update(it.id, { name: e.target.value })} /></TableCell>
                  <TableCell><Input value={it.symbol ?? ''} onChange={e => update(it.id, { symbol: e.target.value })} /></TableCell>
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