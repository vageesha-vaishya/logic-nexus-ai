
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
import { Badge } from '@/components/ui/badge';
import { formatContainerSize } from '@/lib/container-utils';

export default function ContainerTracking() {
  type InventoryRow = Database['public']['Views']['view_container_inventory_summary']['Row'];
  type ContainerSize = Database['public']['Tables']['container_sizes']['Row'];

  const { scopedDb, context } = useCRM();
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [sizes, setSizes] = useState<ContainerSize[]>([]);
  
  // New Item State
  const [newItem, setNewItem] = useState<{
    size_id: string;
    quantity: number;
    status: Database['public']['Enums']['container_status'];
    location_name: string;
  }>({ 
    size_id: '', 
    quantity: 1, 
    status: 'empty', 
    location_name: '' 
  });

  const load = async () => {
    const [viewRes, sizesRes] = await Promise.all([
      scopedDb.from('view_container_inventory_summary' as any).select('*'),
      scopedDb.from('container_sizes').select('*').order('name')
    ]);
    
    setItems((viewRes.data ?? []) as InventoryRow[]);
    setSizes((sizesRes.data ?? []) as ContainerSize[]);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newItem.size_id || newItem.quantity < 0 || !context.tenantId) return;
    
    await scopedDb.from('container_transactions').insert({ 
      tenant_id: context.tenantId,
      size_id: newItem.size_id,
      transaction_type: 'INBOUND',
      quantity_change: newItem.quantity,
      location_name: newItem.location_name,
      status: newItem.status,
      notes: 'Initial Inventory Add'
    });

    setNewItem({ 
      size_id: '', 
      quantity: 1, 
      status: 'empty', 
      location_name: '' 
    });
    setTimeout(load, 500);
  };

  const updateQuantity = async (item: InventoryRow, newQuantity: number) => {
    if (newQuantity < 0 || !context.tenantId || !item.size_id) return;
    const currentQty = item.total_quantity || 0;
    const delta = newQuantity - currentQty;
    if (delta === 0) return;

    await scopedDb.from('container_transactions').insert({
      tenant_id: context.tenantId,
      size_id: item.size_id, 
      location_name: item.location_name || 'Unknown',
      status: item.status || 'empty',
      transaction_type: 'ADJUSTMENT',
      quantity_change: delta,
      notes: 'Manual quantity adjustment'
    });
    setTimeout(load, 500);
  };

  const updateLocation = async (item: InventoryRow, newLocation: string) => {
     if (!context.tenantId || !item.size_id || !newLocation || newLocation === item.location_name) return;
     const qty = item.total_quantity || 0;

     // Out
     await scopedDb.from('container_transactions').insert({
       tenant_id: context.tenantId,
       size_id: item.size_id,
       location_name: item.location_name || 'Unknown',
       status: item.status || 'empty',
       transaction_type: 'ADJUSTMENT',
       quantity_change: -qty,
       notes: `Moving to ${newLocation}`
     });

     // In
     await scopedDb.from('container_transactions').insert({
       tenant_id: context.tenantId,
       size_id: item.size_id,
       location_name: newLocation,
       status: item.status || 'empty',
       transaction_type: 'ADJUSTMENT',
       quantity_change: qty,
       notes: `Moved from ${item.location_name}`
     });
     
     setTimeout(load, 500);
  };

  const updateStatus = async (item: InventoryRow, newStatus: Database['public']['Enums']['container_status']) => {
     if (!context.tenantId || !item.size_id || !newStatus || newStatus === item.status) return;
     const qty = item.total_quantity || 0;

     // Out
     await scopedDb.from('container_transactions').insert({
       tenant_id: context.tenantId,
       size_id: item.size_id,
       location_name: item.location_name || 'Unknown',
       status: item.status || 'empty',
       transaction_type: 'ADJUSTMENT',
       quantity_change: -qty,
       notes: `Status change to ${newStatus}`
     });

     // In
     await scopedDb.from('container_transactions').insert({
       tenant_id: context.tenantId,
       size_id: item.size_id,
       location_name: item.location_name || 'Unknown',
       status: newStatus,
       transaction_type: 'ADJUSTMENT',
       quantity_change: qty,
       notes: `Status change from ${item.status}`
     });
     
     setTimeout(load, 500);
  };

  const remove = async (item: InventoryRow) => {
    if (!context.tenantId || !item.size_id) return;
    const qty = item.total_quantity || 0;
    
    await scopedDb.from('container_transactions').insert({
       tenant_id: context.tenantId,
       size_id: item.size_id,
       location_name: item.location_name || 'Unknown',
       status: item.status || 'empty',
       transaction_type: 'OUTBOUND',
       quantity_change: -qty,
       notes: 'Removed from inventory'
    });
    setTimeout(load, 500);
  };

  const statusOptions: Database['public']['Enums']['container_status'][] = [
    'empty', 'loaded', 'maintenance', 'reserved', 'in_transit'
  ];

  return (
    <DashboardLayout>
      <Card>
        <CardHeader><CardTitle>Container Tracking (Inventory)</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {/* Add Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end border p-4 rounded-lg bg-muted/20">
            <div className="space-y-2 lg:col-span-1">
              <Label>Size / Type</Label>
              <Select value={newItem.size_id} onValueChange={v => setNewItem({ ...newItem, size_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select Container Size" /></SelectTrigger>
                <SelectContent>
                  {sizes.map(s => (
                    <SelectItem key={s.id} value={s.id}>{formatContainerSize(s.name)} ({s.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label>Quantity</Label>
              <Input type="number" min="0" value={newItem.quantity} onChange={e => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label>Status</Label>
              <Select value={newItem.status} onValueChange={(v: any) => setNewItem({ ...newItem, status: v })}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map(s => (
                    <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label>Location</Label>
              <Input placeholder="Warehouse A / Port X" value={newItem.location_name} onChange={e => setNewItem({ ...newItem, location_name: e.target.value })} />
            </div>
            <Button onClick={add}>Add Inventory</Button>
          </div>

          {/* List Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell>Container Size</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>TEU Total</TableCell>
                  <TableCell />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(it => (
                  <TableRow key={it.id || Math.random().toString()}>
                    <TableCell>{(it.size?.match(/(\d+)/)?.[0] || it.size) || '-'}</TableCell>
                    <TableCell>
                      <Input 
                        className="w-24" 
                        type="number" 
                        min="0" 
                        defaultValue={it.total_quantity || 0}
                        onBlur={e => updateQuantity(it, parseInt(e.target.value) || 0)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            updateQuantity(it, parseInt(e.currentTarget.value) || 0);
                            e.currentTarget.blur();
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={it.status || 'empty'} onValueChange={(v: any) => updateStatus(it, v)}>
                        <SelectTrigger className="w-[140px]">
                          <Badge variant={it.status === 'empty' ? 'secondary' : 'default'}>{it.status}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input 
                        defaultValue={it.location_name || ''} 
                        onBlur={e => updateLocation(it, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            updateLocation(it, e.currentTarget.value);
                            e.currentTarget.blur();
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>{it.total_teu ?? '-'}</TableCell>
                    <TableCell>
                      <Button variant="destructive" size="sm" onClick={() => remove(it)}>Remove</Button>
                    </TableCell>
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
