import { Link } from 'react-router-dom';
import { Link2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';

import { usePortfolioTiers } from '../hooks/usePortfolioTiers';
import { usePortfolioPnL } from '../../hooks/usePortfolioPnL';
import { TIER_DEFAULTS, type PortfolioTier } from '../types';
import { GoalProgressAnchor } from './GoalProgressAnchor';

function tierBlurb(tierNumber: 1 | 2 | 3): string {
  return TIER_DEFAULTS.find((d) => d.tier_number === tierNumber)?.description ?? '';
}

function TierCard({ tier }: { tier: PortfolioTier }) {
  // Hook always called — usePortfolioPnL gates fetch on truthy portfolio_id.
  const pnl     = usePortfolioPnL(tier.portfolio_id ?? undefined, 365);
  const summary = pnl.data?.summary;

  const pnlPositive = summary ? summary.total_pnl >= 0 : true;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">{tier.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{tierBlurb(tier.tier_number)}</p>
          </div>
          {summary && (
            <Badge
              variant={pnlPositive ? 'default' : 'destructive'}
              className="text-xs shrink-0"
            >
              {`${summary.pnl_pct >= 0 ? '+' : ''}${summary.pnl_pct.toFixed(1)}%`}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {!tier.portfolio_id ? (
          <Link
            to="/dashboard/markets/portfolios"
            className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/40"
          >
            <Link2 className="h-4 w-4" />
            <span>Link a portfolio to this tier</span>
          </Link>
        ) : pnl.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading P&amp;L…</p>
        ) : pnl.isError ? (
          <p className="text-xs text-rose-600">Unable to load this tier&apos;s performance.</p>
        ) : summary ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current value</span>
              <span className="font-semibold tabular-nums">
                {formatCurrency(summary.current_nav, 'INR', { minimumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total P&amp;L</span>
              <span
                className={`tabular-nums ${pnlPositive ? 'text-emerald-600' : 'text-rose-500'}`}
              >
                {formatCurrency(summary.total_pnl, 'INR', { minimumFractionDigits: 0 })}
              </span>
            </div>
            {tier.target_amount != null && tier.target_amount > 0 && (
              <GoalProgressAnchor
                currentValue={summary.current_nav}
                targetValue={tier.target_amount}
                goalLabel={tier.goals[0] ?? tier.name}
                targetYear={new Date().getFullYear() + 10}
              />
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No transactions yet for this tier.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function PortfolioTierView() {
  const { data: tiers = [], isLoading, isError } = usePortfolioTiers();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading tiers…</p>;
  }
  if (isError) {
    return <p className="text-sm text-rose-600">Unable to load tiers.</p>;
  }
  if (tiers.length === 0) {
    return null;
  }

  const defaultTab = String(tiers[0].tier_number);

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList className="w-full">
        {tiers.map((t) => (
          <TabsTrigger
            key={t.tier_number}
            value={String(t.tier_number)}
            className="flex-1 text-xs"
          >
            {t.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {tiers.map((t) => (
        <TabsContent key={t.tier_number} value={String(t.tier_number)}>
          <TierCard tier={t} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
