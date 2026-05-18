// src/features/markets/retail/community/BasketDiscovery.tsx
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBaskets } from './hooks/useCommunity';
import { RISK_LEVEL_LABELS, RISK_LEVEL_COLORS, type BasketRiskLevel, type CommunityBasket } from './types';

interface BasketDiscoveryProps {
  onSelect: (basket: CommunityBasket) => void;
}

const RISK_FILTERS: Array<BasketRiskLevel | 'all'> = ['all', 'low', 'medium', 'high'];

export function BasketDiscovery({ onSelect }: BasketDiscoveryProps) {
  const { data: baskets = [], isLoading } = useBaskets();
  const [riskFilter, setRiskFilter] = useState<BasketRiskLevel | 'all'>('all');

  const filtered = riskFilter === 'all' ? baskets : baskets.filter(b => b.risk_level === riskFilter);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {RISK_FILTERS.map(f => (
          <Button
            key={f}
            size="sm"
            variant={riskFilter === f ? 'default' : 'outline'}
            className="h-7 text-xs capitalize"
            onClick={() => setRiskFilter(f)}
          >
            {f === 'all' ? 'All' : RISK_LEVEL_LABELS[f]}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(basket => (
          <Card
            key={basket.id}
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => onSelect(basket)}
          >
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">{basket.name}</p>
                  <p className="text-xs text-muted-foreground">{basket.theme}</p>
                </div>
                <Badge variant="outline" className={`text-xs ${RISK_LEVEL_COLORS[basket.risk_level]}`}>
                  {RISK_LEVEL_LABELS[basket.risk_level]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{basket.description}</p>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{basket.follower_count} followers</span>
                <span>₹{(basket.total_invested / 1_00_000).toFixed(1)}L invested</span>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No baskets match your filter.</p>
        )}
      </div>
    </div>
  );
}
