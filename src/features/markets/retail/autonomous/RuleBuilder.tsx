// src/features/markets/retail/autonomous/RuleBuilder.tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateExecutionRule } from './hooks/useExecutionRules';
import type { ExecutionRule } from './types';

const ASSET_CLASSES = ['equity', 'mutual_fund', 'crypto', 'derivative', 'commodity', 'fixed_income', 'forex'];

type RuleFormState = Omit<ExecutionRule, 'id' | 'is_active' | 'created_at'>;

export function RuleBuilder() {
  const { mutate: createRule, isPending } = useCreateExecutionRule();
  const [form, setForm] = useState<RuleFormState>({
    name: '',
    description: '',
    asset_class: 'equity',
    signal_type: 'buy',
    order_type: 'MARKET',
    product: 'CNC',
    max_order_value: 10000,
    algo_id: null,
  });

  const handleSave = () => createRule(form);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Create Auto-Execution Rule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="rule-name" className="text-xs">Rule Name</Label>
          <Input
            id="rule-name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Buy HDFC on strong signal"
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Asset Class</Label>
          <Select value={form.asset_class} onValueChange={v => setForm(f => ({ ...f, asset_class: v }))}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSET_CLASSES.map(ac => (
                <SelectItem key={ac} value={ac} className="text-sm capitalize">
                  {ac.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Signal Type</Label>
            <Select value={form.signal_type} onValueChange={v => setForm(f => ({ ...f, signal_type: v as ExecutionRule['signal_type'] }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="buy">Buy</SelectItem>
                <SelectItem value="sell">Sell</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Order Type</Label>
            <Select value={form.order_type} onValueChange={v => setForm(f => ({ ...f, order_type: v as ExecutionRule['order_type'] }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['MARKET', 'LIMIT', 'SL', 'SL-M'] as const).map(ot => (
                  <SelectItem key={ot} value={ot}>{ot}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Max Order Value (₹)</Label>
          <Input
            type="number"
            value={form.max_order_value}
            onChange={e => setForm(f => ({ ...f, max_order_value: Number(e.target.value) }))}
            className="h-8 text-sm"
            min={1000}
            max={500000}
          />
        </div>

        <Button
          size="sm"
          className="w-full"
          disabled={!form.name || isPending}
          onClick={handleSave}
        >
          {isPending ? 'Saving…' : 'Save Rule'}
        </Button>
      </CardContent>
    </Card>
  );
}
