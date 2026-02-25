import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

type OppItem = {
  id?: string;
  line_number: number;
  product_name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
  discount_amount?: number;
  tax_amount?: number;
  line_total?: number;
};

export function OpportunityItemsEditor({ opportunityId }: { opportunityId: string }) {
  const { scopedDb } = useCRM();
  const [items, setItems] = useState<OppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const { data, error } = await (scopedDb as any)
          .from('opportunity_items', true)
          .select('*')
          .eq('opportunity_id', opportunityId)
          .order('line_number', { ascending: true });
        if (error) throw error;
        setItems((data || []).map((d: any, idx: number) => ({
          id: d.id,
          line_number: d.line_number ?? idx + 1,
          product_name: d.product_name || '',
          description: d.description || '',
          quantity: Number(d.quantity ?? 1),
          unit_price: Number(d.unit_price ?? 0),
          discount_percent: Number(d.discount_percent ?? 0),
          discount_amount: Number(d.discount_amount ?? 0),
          tax_amount: Number(d.tax_amount ?? 0),
          line_total: Number(d.line_total ?? 0),
        })));
      } catch (err: any) {
        console.error('Failed to load opportunity items', err);
      } finally {
        setLoading(false);
      }
    };
    if (opportunityId) fetchItems();
  }, [opportunityId, scopedDb]);

  const addItem = () => {
    setItems((prev) => ([
      ...prev,
      { line_number: prev.length + 1, product_name: '', quantity: 1, unit_price: 0, discount_percent: 0 },
    ]));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index).map((it, i) => ({ ...it, line_number: i + 1 })));
  };

  const updateItem = (index: number, field: keyof OppItem, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const totals = useMemo(() => {
    const rows = items.map((it) => {
      const discountPct = Number(it.discount_percent || 0);
      const lt = Number(it.quantity || 0) * Number(it.unit_price || 0) * (1 - discountPct / 100);
      return { ...it, line_total: lt };
    });
    const subtotal = rows.reduce((sum, r) => sum + (r.line_total || 0), 0);
    const tax = rows.reduce((sum, r) => sum + Number(r.tax_amount || 0), 0);
    const total = subtotal + tax;
    return { rows, subtotal, tax, total };
  }, [items]);

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Replace all items for simplicity
      const { error: delErr } = await (scopedDb as any)
        .from('opportunity_items', true)
        .delete()
        .eq('opportunity_id', opportunityId);
      if (delErr) throw delErr;

      const payload = totals.rows.map((r) => ({
        opportunity_id: opportunityId,
        line_number: r.line_number,
        product_name: r.product_name,
        description: r.description || null,
        quantity: r.quantity,
        unit_price: r.unit_price,
        discount_percent: r.discount_percent || 0,
        discount_amount: r.discount_amount || 0,
        tax_amount: r.tax_amount || 0,
        line_total: r.line_total || 0,
      }));

      if (payload.length > 0) {
        const { error: insErr } = await (scopedDb as any).from('opportunity_items', true).insert(payload as any[]);
        if (insErr) throw insErr;
      }

      toast.success('Opportunity items saved');
    } catch (err: any) {
      toast.error('Failed to save items', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Opportunity Products</CardTitle>
          <Button type="button" onClick={addItem} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading items…</div>
        ) : items.length === 0 ? (
          <div className="rounded border p-4">
            <p className="text-sm text-muted-foreground">No items yet. Add your first product.</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-4">
              <div className="flex justify-between items-start">
                <span className="font-medium">Item {index + 1}</span>
                {items.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Product Name</Label>
                  <Input value={item.product_name} onChange={(e) => updateItem(index, 'product_name', e.target.value)} placeholder="Product Name" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={item.description || ''} onChange={(e) => updateItem(index, 'description', e.target.value)} placeholder="Description" />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Unit Price</Label>
                  <Input type="number" step="0.01" value={item.unit_price} onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Discount %</Label>
                  <Input type="number" step="0.01" value={item.discount_percent || 0} onChange={(e) => updateItem(index, 'discount_percent', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="flex items-end">
                  <span className="text-sm font-medium">Line Total: ${((item.quantity || 0) * (item.unit_price || 0) * (1 - (item.discount_percent || 0) / 100)).toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))
        )}

        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm text-muted-foreground">Subtotal: ${totals.subtotal.toFixed(2)} • Tax: ${totals.tax.toFixed(2)}</div>
          <div className="font-semibold">Total: ${totals.total.toFixed(2)}</div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={saving} onClick={() => setItems([])}>Clear</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Items'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
