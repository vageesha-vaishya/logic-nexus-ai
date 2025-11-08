import { useEffect, useState, useMemo } from 'react';
import { Table, TableHeader, TableRow, TableCell, TableBody } from '@/components/ui/table';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

type ChargeRow = {
  charge_side_id?: string;
  category_id?: string;
  basis_id?: string;
  quantity?: number;
  unit?: string | null;
  rate?: number;
  amount?: number;
  currency_id?: string;
  note?: string | null;
  sort_order?: number;
  side?: 'buy' | 'sell';
};

export default function ChargesTable({ charges, onChange }: { charges: ChargeRow[]; onChange: (rows: ChargeRow[]) => void }) {
  const [sides, setSides] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [bases, setBases] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: ss } = await supabase.from('charge_sides').select('id, name, code').order('name');
      setSides(ss ?? []);
      const { data: cc } = await supabase.from('charge_categories').select('id, name, code').order('name');
      setCategories(cc ?? []);
      const { data: bb } = await supabase.from('charge_bases').select('id, name, code').order('name');
      setBases(bb ?? []);
      const { data: cur } = await supabase.from('currencies').select('id, code').order('code');
      setCurrencies(cur ?? []);
    })();
  }, []);

  const totals = useMemo(() => {
    const buy = charges.filter(c => c.side === 'buy').reduce((s, c) => s + (c.amount || (c.rate ?? 0) * (c.quantity ?? 1)), 0);
    const sell = charges.filter(c => c.side === 'sell').reduce((s, c) => s + (c.amount || (c.rate ?? 0) * (c.quantity ?? 1)), 0);
    return { buy, sell, margin: sell - buy };
  }, [charges]);

  const addRow = (sideCode: 'buy'|'sell') => {
    const side = sides.find(s => s.code === sideCode);
    onChange([
      ...charges,
      {
        side: sideCode,
        charge_side_id: side?.id,
        category_id: categories[0]?.id,
        basis_id: bases[0]?.id,
        quantity: 1,
        rate: 0,
        amount: 0,
        currency_id: currencies[0]?.id,
        note: null,
        sort_order: 1000,
      },
    ]);
  };

  const updateRow = (idx: number, patch: Partial<ChargeRow>) => {
    const next = charges.slice();
    next[idx] = { ...next[idx], ...patch };
    const q = next[idx].quantity ?? 1;
    const r = next[idx].rate ?? 0;
    next[idx].amount = Number(next[idx].amount ?? r * q);
    onChange(next);
  };

  const removeRow = (idx: number) => {
    const next = charges.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => addRow('buy')}>Add Buy Charge</Button>
        <Button onClick={() => addRow('sell')}>Add Sell Charge</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableCell>Side</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Basis</TableCell>
            <TableCell>Qty</TableCell>
            <TableCell>Unit</TableCell>
            <TableCell>Rate</TableCell>
            <TableCell>Amount</TableCell>
            <TableCell>Currency</TableCell>
            <TableCell>Note</TableCell>
            <TableCell />
          </TableRow>
        </TableHeader>
        <TableBody>
          {charges.map((c, idx) => (
            <TableRow key={idx}>
              <TableCell>
                <Select value={c.charge_side_id} onValueChange={(val) => updateRow(idx, { charge_side_id: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sides.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select value={c.category_id} onValueChange={(val) => updateRow(idx, { category_id: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select value={c.basis_id} onValueChange={(val) => updateRow(idx, { basis_id: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {bases.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell><Input type="number" value={c.quantity ?? 1} onChange={e => updateRow(idx, { quantity: Number(e.target.value) })} /></TableCell>
              <TableCell><Input value={c.unit ?? ''} onChange={e => updateRow(idx, { unit: e.target.value })} /></TableCell>
              <TableCell><Input type="number" value={c.rate ?? 0} onChange={e => updateRow(idx, { rate: Number(e.target.value), amount: Number(e.target.value) * (c.quantity || 1) })} /></TableCell>
              <TableCell><Input type="number" value={c.amount ?? 0} onChange={e => updateRow(idx, { amount: Number(e.target.value) })} /></TableCell>
              <TableCell>
                <Select value={c.currency_id} onValueChange={(val) => updateRow(idx, { currency_id: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currencies.map(cur => <SelectItem key={cur.id} value={cur.id}>{cur.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell><Input value={c.note ?? ''} onChange={e => updateRow(idx, { note: e.target.value })} /></TableCell>
              <TableCell><Button variant="destructive" size="sm" onClick={() => removeRow(idx)}>Remove</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-end gap-6 text-sm">
        <div>Buy: <span className="font-semibold">{totals.buy.toFixed(2)}</span></div>
        <div>Sell: <span className="font-semibold">{totals.sell.toFixed(2)}</span></div>
        <div>Margin: <span className="font-semibold">{totals.margin.toFixed(2)}</span></div>
      </div>
    </div>
  );
}