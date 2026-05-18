// src/features/markets/retail/community/BasketDetail.tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useBasketHoldings, useInvestInBasket } from './hooks/useCommunity';
import { RISK_LEVEL_LABELS, RISK_LEVEL_COLORS, formatWeight, type CommunityBasket } from './types';

interface BasketDetailProps {
  basket: CommunityBasket;
  onBack: () => void;
}

export function BasketDetail({ basket, onBack }: BasketDetailProps) {
  const { data: holdings = [], isLoading } = useBasketHoldings(basket.id);
  const { mutate: invest, isPending } = useInvestInBasket();
  const [amount, setAmount] = useState('');

  return (
    <div className="space-y-4">
      <Button size="sm" variant="ghost" onClick={onBack} className="text-xs -ml-2">
        ← Back to baskets
      </Button>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{basket.name}</h3>
          <Badge variant="outline" className={`text-xs ${RISK_LEVEL_COLORS[basket.risk_level]}`}>
            {RISK_LEVEL_LABELS[basket.risk_level]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{basket.description}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Holdings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <div className="h-16 bg-muted rounded animate-pulse" />}
          {holdings.map(h => (
            <div key={h.id} className="flex items-center justify-between text-xs">
              <span className="font-medium">{h.instrument?.symbol ?? h.instrument_id}</span>
              <span className="text-muted-foreground">{formatWeight(h.weight_pct)}</span>
            </div>
          ))}
          {!isLoading && holdings.length === 0 && (
            <p className="text-xs text-muted-foreground">No holdings added yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Investment Amount (₹)</Label>
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 10000"
              className="h-8 text-sm"
              min={500}
            />
          </div>
          <Button
            size="sm"
            className="w-full"
            disabled={!amount || Number(amount) <= 0 || isPending}
            onClick={() => invest({ basketId: basket.id, amount: Number(amount) })}
          >
            {isPending ? 'Investing…' : `Invest ₹${Number(amount).toLocaleString('en-IN')}`}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Amount is allocated across all holdings proportionally.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
