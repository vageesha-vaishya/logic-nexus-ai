import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableCell, TableBody } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useCRM } from '@/hooks/useCRM';
import type { Database } from '@/integrations/supabase/types';

export default function ContainerSizes() {
  type ContainerSize = Database['public']['Tables']['container_sizes']['Row'];
  type ContainerType = Database['public']['Tables']['container_types']['Row'];

  const { scopedDb } = useCRM();
  const [items, setItems] = useState<ContainerSize[]>([]);
  const [types, setTypes] = useState<ContainerType[]>([]);
  const [newItem, setNewItem] = useState<{
    name: string;
    code: string;
    description: string;
    type_id: string;
    teu_factor: number;
    iso_code: string;
  }>({ 
    name: '', 
    code: '', 
    description: '',
    type_id: '',
    teu_factor: 1.0,
    iso_code: ''
  });

  const load = async () => {
    const [sizesRes, typesRes] = await Promise.all([
      scopedDb.from('container_sizes').select('*').order('name'),
      scopedDb.from('container_types').select('*').order('name')
    ]);
    
    setItems((sizesRes.data ?? []) as ContainerSize[]);
    setTypes((typesRes.data ?? []) as ContainerType[]);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newItem.name || !newItem.type_id) return;
    const isUUID = (v: any) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    await scopedDb.from('container_sizes').insert({ 
      ...newItem,
      type_id: newItem.type_id === '' ? null : (isUUID(newItem.type_id) ? newItem.type_id : null)
    });
    setNewItem({ 
      name: '', 
      code: '', 
      description: '',
      type_id: '',
      teu_factor: 1.0,
      iso_code: '',
      length_ft: 20,
      width_ft: 8,
      height_ft: 8.5,
      max_gross_weight_kg: 30480,
      is_high_cube: false
    });
    load();
  };

  const update = async (id: string, patch: Partial<ContainerSize>) => {
    const isUUID = (v: any) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    if (!isUUID(id)) return;
    await scopedDb.from('container_sizes').update(patch).eq('id', id);
    load();
  };

  const remove = async (id: string) => {
    const isUUID = (v: any) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    if (!isUUID(id)) return;
    await scopedDb.from('container_sizes').delete().eq('id', id);
    load();
  };

  const getTypeName = (id: string | null) => {
    if (!id) return '-';
    return types.find(t => t.id === id)?.name || id;
  };

  return (
    <DashboardLayout>
      <Card>
        <CardHeader><CardTitle>Container Sizes</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 items-end border p-4 rounded-lg bg-muted/20">
            <div className="space-y-2 lg:col-span-1">
              <Label>Type</Label>
              <Select value={newItem.type_id} onValueChange={v => setNewItem({ ...newItem, type_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                <SelectContent>
                  {types.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label>Name</Label>
              <Input placeholder="20' Standard" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label>Code</Label>
              <Input placeholder="20GP" value={newItem.code} onChange={e => setNewItem({ ...newItem, code: e.target.value })} />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label>ISO</Label>
              <Input placeholder="22G1" value={newItem.iso_code} onChange={e => setNewItem({ ...newItem, iso_code: e.target.value })} />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label>TEU</Label>
              <Input type="number" step="0.1" value={newItem.teu_factor} onChange={e => setNewItem({ ...newItem, teu_factor: parseFloat(e.target.value) })} />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label>Length (ft)</Label>
              <Input type="number" step="0.1" value={newItem.length_ft} onChange={e => setNewItem({ ...newItem, length_ft: parseFloat(e.target.value) })} />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label>Width (ft)</Label>
              <Input type="number" step="0.1" value={newItem.width_ft} onChange={e => setNewItem({ ...newItem, width_ft: parseFloat(e.target.value) })} />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label>Height (ft)</Label>
              <Input type="number" step="0.1" value={newItem.height_ft} onChange={e => setNewItem({ ...newItem, height_ft: parseFloat(e.target.value) })} />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label>Max Weight (kg)</Label>
              <Input type="number" value={newItem.max_gross_weight_kg} onChange={e => setNewItem({ ...newItem, max_gross_weight_kg: parseFloat(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-2 items-center justify-center">
              <Label className="text-xs">High Cube</Label>
              <Switch checked={newItem.is_high_cube} onCheckedChange={c => setNewItem({ ...newItem, is_high_cube: c })} />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label>Description</Label>
              <Input placeholder="Desc..." value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} />
            </div>
            <div className="lg:col-span-1 flex items-end">
              <Button onClick={add} className="w-full">Add Size</Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>ISO</TableCell>
                  <TableCell>TEU</TableCell>
                  <TableCell>Dimensions (LxWxH)</TableCell>
                  <TableCell>Max Weight</TableCell>
                  <TableCell>HC</TableCell>
                  <TableCell>Active</TableCell>
                  <TableCell />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(it => (
                  <TableRow key={it.id}>
                    <TableCell>
                      <Select value={it.type_id || ''} onValueChange={v => update(it.id, { type_id: v })}>
                        <SelectTrigger className="w-[140px]"><SelectValue>{getTypeName(it.type_id)}</SelectValue></SelectTrigger>
                        <SelectContent>
                          {types.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input value={it.name ?? ''} onChange={e => update(it.id, { name: e.target.value })} /></TableCell>
                    <TableCell><Input className="w-16" value={it.code ?? ''} onChange={e => update(it.id, { code: e.target.value })} /></TableCell>
                    <TableCell><Input className="w-16" value={it.iso_code ?? ''} onChange={e => update(it.id, { iso_code: e.target.value })} /></TableCell>
                    <TableCell><Input className="w-16" type="number" step="0.1" value={it.teu_factor ?? 1.0} onChange={e => update(it.id, { teu_factor: parseFloat(e.target.value) })} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1 items-center">
                        <Input className="w-14" type="number" step="0.1" value={it.length_ft ?? 0} onChange={e => update(it.id, { length_ft: parseFloat(e.target.value) })} />
                        <span>x</span>
                        <Input className="w-14" type="number" step="0.1" value={it.width_ft ?? 0} onChange={e => update(it.id, { width_ft: parseFloat(e.target.value) })} />
                        <span>x</span>
                        <Input className="w-14" type="number" step="0.1" value={it.height_ft ?? 0} onChange={e => update(it.id, { height_ft: parseFloat(e.target.value) })} />
                      </div>
                    </TableCell>
                    <TableCell><Input className="w-20" type="number" value={it.max_gross_weight_kg ?? 0} onChange={e => update(it.id, { max_gross_weight_kg: parseFloat(e.target.value) })} /></TableCell>
                    <TableCell>
                       <Switch checked={it.is_high_cube || false} onCheckedChange={c => update(it.id, { is_high_cube: c })} />
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => update(it.id, { is_active: !it.is_active })}>
                        {it.is_active ? 'Active' : 'Inactive'}
                      </Button>
                    </TableCell>
                    <TableCell><Button variant="destructive" size="sm" onClick={() => remove(it.id)}>Del</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
