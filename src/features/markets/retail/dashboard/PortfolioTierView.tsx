import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePortfolioTiers } from '../hooks/usePortfolioTiers';
import { usePortfolioPnL } from '../../hooks/usePortfolioPnL';
import { GoalProgressAnchor } from './GoalProgressAnchor';
import type { Goal, PortfolioTier } from '../types';

interface TierCardProps {
  tier: PortfolioTier;
  profileGoals: Goal[];
}

function TierCard({ tier, profileGoals }: TierCardProps) {
  const pnl = usePortfolioPnL(tier.portfolio_id ?? undefined, 365);
  const summary = pnl.data?.summary;

  // Match the tier's first goal against profile goals to get the target year
  const firstGoalId = tier.goals[0];
  const matchedGoal = profileGoals.find((g) => g.goal === firstGoalId);
  const targetYear = matchedGoal
    ? new Date().getFullYear() + matchedGoal.years
    : new Date().getFullYear() + 10;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{tier.name}</CardTitle>
          <Badge
            variant={summary && summary.total_pnl >= 0 ? 'default' : 'destructive'}
            className="text-xs"
          >
            {summary
              ? `${summary.pnl_pct >= 0 ? '+' : ''}${summary.pnl_pct.toFixed(1)}%`
              : '—'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Current value</span>
          <span className="font-semibold">
            {summary ? `₹${summary.current_nav.toLocaleString('en-IN')}` : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total P&amp;L</span>
          <span className={summary && summary.total_pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}>
            {summary ? `₹${summary.total_pnl.toLocaleString('en-IN')}` : '—'}
          </span>
        </div>
        {tier.target_amount && summary && (
          <GoalProgressAnchor
            currentValue={summary.current_nav}
            targetValue={tier.target_amount}
            goalLabel={firstGoalId ?? tier.name}
            targetYear={targetYear}
          />
        )}
      </CardContent>
    </Card>
  );
}

interface PortfolioTierViewProps {
  profileGoals?: Goal[];
}

export function PortfolioTierView({ profileGoals = [] }: PortfolioTierViewProps) {
  const { data: tiers = [], isLoading } = usePortfolioTiers();

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading tiers…</div>;
  }
  if (tiers.length === 0) {
    return null;
  }

  return (
    <Tabs defaultValue={String(tiers[0].tier_number)}>
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
          <TierCard tier={t} profileGoals={profileGoals} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
