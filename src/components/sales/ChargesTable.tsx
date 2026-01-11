import { useEffect, useState, useMemo } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Table, TableHeader, TableRow, TableCell, TableBody } from '@/components/ui/table';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';


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

type CombinedRow = {
  key: string;
  category_id?: string;
  basis_id?: string;
  unit?: string | null;
  currency_id?: string;
  note?: string | null;
  buy?: { idx: number; quantity?: number; rate?: number; amount?: number; charge_side_id?: string };
  sell?: { idx: number; quantity?: number; rate?: number; amount?: number; charge_side_id?: string };
};

export default function ChargesTable({ charges, onChange, defaultCurrencyId, onSaveClick, saveDisabled }: { charges: ChargeRow[]; onChange: (rows: ChargeRow[]) => void; defaultCurrencyId?: string | null; onSaveClick?: () => void; saveDisabled?: boolean }) {
  const { scopedDb } = useCRM();
  const [sides, setSides] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [bases, setBases] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: ss } = await scopedDb.from('charge_sides', true).select('id, name, code').order('name');
      setSides(ss ?? []);
      const { data: cc } = await scopedDb.from('charge_categories', true).select('id, name, code').order('name');
      setCategories(cc ?? []);
      const { data: bb } = await scopedDb.from('charge_bases', true).select('id, name, code').order('name');
      setBases(bb ?? []);
      const { data: cur } = await scopedDb.from('currencies', true).select('id, code').order('code');
      setCurrencies(cur ?? []);
    })();
  }, [scopedDb]);

  const totals = useMemo(() => {
    const buy = charges.filter(c => c.side === 'buy').reduce((s, c) => s + (c.amount || (c.rate ?? 0) * (c.quantity ?? 1)), 0);
    const sell = charges.filter(c => c.side === 'sell').reduce((s, c) => s + (c.amount || (c.rate ?? 0) * (c.quantity ?? 1)), 0);
    return { buy, sell, margin: sell - buy };
  }, [charges]);

  const groupKey = (c: ChargeRow) => [c.category_id ?? '', c.basis_id ?? '', c.currency_id ?? '', c.unit ?? '', c.note ?? ''].join('|');

  const combinedRows = useMemo<CombinedRow[]>(() => {
    const map = new Map<string, CombinedRow>();
    charges.forEach((c, idx) => {
      const key = groupKey(c);
      const entry = map.get(key) ?? {
        key,
        category_id: c.category_id,
        basis_id: c.basis_id,
        unit: c.unit ?? null,
        currency_id: c.currency_id,
        note: c.note ?? null,
      };
      const sideRef = { idx, quantity: c.quantity, rate: c.rate, amount: c.amount, charge_side_id: c.charge_side_id };
      if (c.side === 'buy') entry.buy = sideRef; else if (c.side === 'sell') entry.sell = sideRef;
      map.set(key, entry);
    });
    return Array.from(map.values());
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
        currency_id: defaultCurrencyId ?? currencies[0]?.id,
        note: null,
        sort_order: 1000,
      },
    ]);
  };

  const addCombinedRow = () => {
    const buySide = sides.find(s => s.code === 'buy');
    const sellSide = sides.find(s => s.code === 'sell');
    const base = {
      category_id: categories[0]?.id,
      basis_id: bases[0]?.id,
      unit: '',
      currency_id: defaultCurrencyId ?? currencies[0]?.id,
      note: null as string | null,
      sort_order: 1000,
    };
    const newRows: ChargeRow[] = [
      { ...base, side: 'buy', charge_side_id: buySide?.id, quantity: 1, rate: 0, amount: 0 },
      { ...base, side: 'sell', charge_side_id: sellSide?.id, quantity: 1, rate: 0, amount: 0 },
    ];
    onChange([...(charges ?? []), ...newRows]);
  };

  const updateRow = (idx: number, patch: Partial<ChargeRow>) => {
    const next = charges.slice();
    next[idx] = { ...next[idx], ...patch };
    const q = next[idx].quantity ?? 1;
    const r = next[idx].rate ?? 0;
    next[idx].amount = Number(next[idx].amount ?? r * q);
    onChange(next);
  };

  const removeCombinedRow = (row: CombinedRow) => {
    const next = charges.slice();
    const indexes = [row.buy?.idx, row.sell?.idx].filter((x): x is number => typeof x === 'number').sort((a,b) => b-a);
    indexes.forEach(i => next.splice(i, 1));
    onChange(next);
  };

  const updateShared = (row: CombinedRow, patchShared: Partial<ChargeRow>) => {
    const next = charges.slice();
    [row.buy?.idx, row.sell?.idx].forEach(i => {
      if (typeof i === 'number') {
        next[i] = { ...next[i], ...patchShared };
        const q = next[i].quantity ?? 1;
        const r = next[i].rate ?? 0;
        next[i].amount = Number(next[i].amount ?? r * q);
      }
    });
    onChange(next);
  };

  const updateSide = (sideIdx: number | undefined, patch: Partial<ChargeRow>) => {
    if (typeof sideIdx !== 'number') return;
    const next = charges.slice();
    next[sideIdx] = { ...next[sideIdx], ...patch };
    const q = next[sideIdx].quantity ?? 1;
    const r = next[sideIdx].rate ?? 0;
    next[sideIdx].amount = Number(next[sideIdx].amount ?? r * q);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button variant="outline" onClick={addCombinedRow}>Add Combined Charge</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableCell>Category</TableCell>
            <TableCell>Basis</TableCell>
            <TableCell>Unit</TableCell>
            <TableCell>Currency</TableCell>
            <TableCell>Buy Qty</TableCell>
            <TableCell>Buy Rate</TableCell>
            <TableCell>Buy Amount</TableCell>
            <TableCell>Sell Qty</TableCell>
            <TableCell>Sell Rate</TableCell>
            <TableCell>Sell Amount</TableCell>
            <TableCell>Note</TableCell>
            <TableCell />
          </TableRow>
        </TableHeader>
        <TableBody>
          {combinedRows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>
                <Select value={row.category_id} onValueChange={(val) => updateShared(row, { category_id: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select value={row.basis_id} onValueChange={(val) => updateShared(row, { basis_id: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {bases.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell><Input value={row.unit ?? ''} onChange={e => updateShared(row, { unit: e.target.value })} /></TableCell>
              <TableCell>
                <Select value={row.currency_id} onValueChange={(val) => updateShared(row, { currency_id: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currencies.map(cur => <SelectItem key={cur.id} value={cur.id}>{cur.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell><Input type="number" value={row.buy?.quantity ?? 1} onChange={e => updateSide(row.buy?.idx, { quantity: Number(e.target.value) })} /></TableCell>
              <TableCell><Input type="number" value={row.buy?.rate ?? 0} onChange={e => updateSide(row.buy?.idx, { rate: Number(e.target.value), amount: Number(e.target.value) * (row.buy?.quantity || 1) })} /></TableCell>
              <TableCell><Input type="number" value={row.buy?.amount ?? 0} onChange={e => updateSide(row.buy?.idx, { amount: Number(e.target.value) })} /></TableCell>
              <TableCell><Input type="number" value={row.sell?.quantity ?? 1} onChange={e => updateSide(row.sell?.idx, { quantity: Number(e.target.value) })} /></TableCell>
              <TableCell><Input type="number" value={row.sell?.rate ?? 0} onChange={e => updateSide(row.sell?.idx, { rate: Number(e.target.value), amount: Number(e.target.value) * (row.sell?.quantity || 1) })} /></TableCell>
              <TableCell><Input type="number" value={row.sell?.amount ?? 0} onChange={e => updateSide(row.sell?.idx, { amount: Number(e.target.value) })} /></TableCell>
              <TableCell><Input value={row.note ?? ''} onChange={e => updateShared(row, { note: e.target.value })} /></TableCell>
              <TableCell><Button variant="destructive" size="sm" onClick={() => removeCombinedRow(row)}>Remove</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-end gap-6 text-sm">
        <div>Buy: <span className="font-semibold">{totals.buy.toFixed(2)}</span></div>
        <div>Sell: <span className="font-semibold">{totals.sell.toFixed(2)}</span></div>
        <div>Margin: <span className="font-semibold">{totals.margin.toFixed(2)}</span></div>
        {onSaveClick && (
          <Button onClick={onSaveClick} disabled={!!saveDisabled}>Save Charges</Button>
        )}
      </div>
    </div>
  );
}