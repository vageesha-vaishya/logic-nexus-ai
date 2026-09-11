import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableCell, TableBody } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCRM } from '@/hooks/useCRM';
import type { Database } from '@/integrations/supabase/types';
import { deriveContainerSizeLabel } from '@/lib/container-utils';

// public.container_sizes has no name/code/iso_code/description/is_active/
// teu_factor/max_gross_weight_kg column -- only dimensional data (see
// \d public.container_sizes on the production DB). This admin editor was
// previously built entirely against those nonexistent columns (silently
// type-checked as valid only because it imported a STALE, unused duplicate
// types file -- see docs note in git history) and every save/list/delete
// call 400'd. Rebuilt against the real columns; there's no free-text label
// to edit, so the table shows a computed one (deriveContainerSizeLabel)
// instead of an editable Name/Code pair.
export default function ContainerSizes() {
  type ContainerSize = Database['public']['Tables']['container_sizes']['Row'];
  type ContainerType = Database['public']['Tables']['container_types']['Row'];

  const { scopedDb } = useCRM();
  const [items, setItems] = useState<ContainerSize[]>([]);
  const [types, setTypes] = useState<ContainerType[]>([]);

  const emptyNewItem = {
    container_type_id: '',
    length_ft: 20,
    width_ft: 8,
    height_ft: 8.5,
    internal_length_mm: 5898,
    internal_width_mm: 2352,
    internal_height_mm: 2393,
    door_width_mm: 2340,
    door_height_mm: 2280,
    capacity_cbm: 33.2,
    max_payload_kg: 28180,
    tare_weight_kg: 2300,
    max_stack_weight_kg: 192000,
    is_high_cube: false,
    is_pallet_wide: false,
  };
  const [newItem, setNewItem] = useState(emptyNewItem);

  const load = async () => {
    const [sizesRes, typesRes] = await Promise.all([
      scopedDb.from('container_sizes').select('*').order('length_ft'),
      scopedDb.from('container_types').select('*').order('name'),
    ]);

    setItems((sizesRes.data ?? []) as ContainerSize[]);
    setTypes((typesRes.data ?? []) as ContainerType[]);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newItem.container_type_id) return;
    await scopedDb.from('container_sizes').insert(newItem);
    setNewItem(emptyNewItem);
    load();
  };

  const update = async (id: string, patch: Partial<ContainerSize>) => {
    await scopedDb.from('container_sizes').update(patch).eq('id', id);
    load();
  };

  const remove = async (id: string) => {
    await scopedDb.from('container_sizes').delete().eq('id', id);
    load();
  };

  const getTypeName = (id: string | null) => {
    if (!id) return '-';
    return types.find(t => t.id === id)?.name || id;
  };

  const numberField = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    step = 1,
  ) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" step={step} value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} />
    </div>
  );

  return (
    <DashboardLayout>
      <Card>
        <CardHeader><CardTitle>Container Sizes</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end border p-4 rounded-lg bg-muted/20">
            <div className="space-y-2 lg:col-span-1">
              <Label>Type</Label>
              <Select value={newItem.container_type_id} onValueChange={v => setNewItem({ ...newItem, container_type_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                <SelectContent>
                  {types.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {numberField('Length (ft)', newItem.length_ft, v => setNewItem({ ...newItem, length_ft: v }), 0.1)}
            {numberField('Width (ft)', newItem.width_ft, v => setNewItem({ ...newItem, width_ft: v }), 0.1)}
            {numberField('Height (ft)', newItem.height_ft, v => setNewItem({ ...newItem, height_ft: v }), 0.1)}
            {numberField('Capacity (cbm)', newItem.capacity_cbm, v => setNewItem({ ...newItem, capacity_cbm: v }), 0.1)}
            {numberField('Internal Length (mm)', newItem.internal_length_mm, v => setNewItem({ ...newItem, internal_length_mm: v }))}
            {numberField('Internal Width (mm)', newItem.internal_width_mm, v => setNewItem({ ...newItem, internal_width_mm: v }))}
            {numberField('Internal Height (mm)', newItem.internal_height_mm, v => setNewItem({ ...newItem, internal_height_mm: v }))}
            {numberField('Door Width (mm)', newItem.door_width_mm, v => setNewItem({ ...newItem, door_width_mm: v }))}
            {numberField('Door Height (mm)', newItem.door_height_mm, v => setNewItem({ ...newItem, door_height_mm: v }))}
            {numberField('Max Payload (kg)', newItem.max_payload_kg, v => setNewItem({ ...newItem, max_payload_kg: v }))}
            {numberField('Tare Weight (kg)', newItem.tare_weight_kg, v => setNewItem({ ...newItem, tare_weight_kg: v }))}
            {numberField('Max Stack Weight (kg)', newItem.max_stack_weight_kg, v => setNewItem({ ...newItem, max_stack_weight_kg: v }))}
            <div className="flex flex-col gap-2 items-center justify-center">
              <Label className="text-xs">High Cube</Label>
              <Switch checked={newItem.is_high_cube} onCheckedChange={c => setNewItem({ ...newItem, is_high_cube: c })} />
            </div>
            <div className="flex flex-col gap-2 items-center justify-center">
              <Label className="text-xs">Pallet Wide</Label>
              <Switch checked={newItem.is_pallet_wide} onCheckedChange={c => setNewItem({ ...newItem, is_pallet_wide: c })} />
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
                  <TableCell>Label</TableCell>
                  <TableCell>Dimensions (LxWxH ft)</TableCell>
                  <TableCell>Capacity (cbm)</TableCell>
                  <TableCell>Max Payload (kg)</TableCell>
                  <TableCell>Tare (kg)</TableCell>
                  <TableCell>HC</TableCell>
                  <TableCell>PW</TableCell>
                  <TableCell />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(it => (
                  <TableRow key={it.id}>
                    <TableCell>
                      <Select value={it.container_type_id || ''} onValueChange={v => update(it.id, { container_type_id: v })}>
                        <SelectTrigger className="w-[140px]"><SelectValue>{getTypeName(it.container_type_id)}</SelectValue></SelectTrigger>
                        <SelectContent>
                          {types.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="font-medium">{deriveContainerSizeLabel(it)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 items-center">
                        <Input className="w-14" type="number" step="0.1" value={it.length_ft ?? 0} onChange={e => update(it.id, { length_ft: parseFloat(e.target.value) || 0 })} />
                        <span>x</span>
                        <Input className="w-14" type="number" step="0.1" value={it.width_ft ?? 0} onChange={e => update(it.id, { width_ft: parseFloat(e.target.value) || 0 })} />
                        <span>x</span>
                        <Input className="w-14" type="number" step="0.1" value={it.height_ft ?? 0} onChange={e => update(it.id, { height_ft: parseFloat(e.target.value) || 0 })} />
                      </div>
                    </TableCell>
                    <TableCell><Input className="w-20" type="number" step="0.1" value={it.capacity_cbm ?? 0} onChange={e => update(it.id, { capacity_cbm: parseFloat(e.target.value) || 0 })} /></TableCell>
                    <TableCell><Input className="w-24" type="number" value={it.max_payload_kg ?? 0} onChange={e => update(it.id, { max_payload_kg: parseFloat(e.target.value) || 0 })} /></TableCell>
                    <TableCell><Input className="w-20" type="number" value={it.tare_weight_kg ?? 0} onChange={e => update(it.id, { tare_weight_kg: parseFloat(e.target.value) || 0 })} /></TableCell>
                    <TableCell>
                       <Switch checked={it.is_high_cube || false} onCheckedChange={c => update(it.id, { is_high_cube: c })} />
                    </TableCell>
                    <TableCell>
                       <Switch checked={it.is_pallet_wide || false} onCheckedChange={c => update(it.id, { is_pallet_wide: c })} />
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
