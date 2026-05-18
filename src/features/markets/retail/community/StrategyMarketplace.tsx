// src/features/markets/retail/community/StrategyMarketplace.tsx
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useStrategies, useDeployStrategy } from './hooks/useCommunity';
import { useAutonomyProgress } from '../autonomous/hooks/useAutonomyProgress';

export function StrategyMarketplace() {
  const { data: strategies = [], isLoading } = useStrategies();
  const { mutate: deploy, isPending } = useDeployStrategy();
  const { data: progress } = useAutonomyProgress();

  const isInPaperPhase = !progress || progress.current_phase === 'paper';

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isInPaperPhase && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 p-3">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            Complete paper trading (10 trades) to deploy community strategies.
          </p>
        </div>
      )}

      {strategies.map(strategy => (
        <Card key={strategy.id}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">{strategy.name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {strategy.asset_class.replace(/_/g, ' ')}
                </p>
              </div>
              {strategy.rating != null && (
                <Badge variant="secondary" className="text-xs">★ {strategy.rating.toFixed(1)}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{strategy.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{strategy.live_users} using this</span>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={isInPaperPhase || isPending}
                onClick={() => deploy(strategy.id)}
              >
                {isInPaperPhase ? 'Paper phase' : 'Deploy'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {strategies.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">No published strategies yet.</p>
      )}
    </div>
  );
}
