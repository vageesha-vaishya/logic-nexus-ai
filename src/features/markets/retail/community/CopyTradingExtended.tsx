// src/features/markets/retail/community/CopyTradingExtended.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function CopyTradingExtended() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-3">
        <p className="text-xs text-blue-800 dark:text-blue-200">
          <strong>Safety limits:</strong> Copy trading is only allowed in your Experimental tier.
          Maximum 20% of Experimental tier NAV per copied trader.
          Auto-unfollow triggers if copied trader drawdown exceeds your limit.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Top Traders Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Traders ranked by risk-adjusted returns (Sharpe), max drawdown, and consistency.
            All performance metrics are real — no simulated results.
          </p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs border rounded-lg p-2">
              <div>
                <p className="font-medium">Connect a broker to view top traders</p>
                <p className="text-muted-foreground">Leaderboard loads from your broker connection</p>
              </div>
              <Badge variant="outline" className="text-xs">Experimental only</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
