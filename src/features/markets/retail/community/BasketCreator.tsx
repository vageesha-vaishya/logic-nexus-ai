// src/features/markets/retail/community/BasketCreator.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCreatorStatus } from './hooks/useCommunity';

export function BasketCreator() {
  const { data: creator, isLoading } = useCreatorStatus();

  if (isLoading) return <div className="h-24 bg-muted rounded-lg animate-pulse" />;

  if (!creator?.is_verified) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center space-y-2">
          <Badge variant="outline" className="text-xs">Verified Creator Required</Badge>
          <p className="text-sm text-muted-foreground">
            Only SEBI-registered research analysts and verified creators can publish baskets.
            Contact support to apply for creator verification.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">Create Basket</CardTitle>
          <Badge className="text-xs">Verified Creator</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Basket creation form — define theme, add instruments with weights, set rebalancing frequency.
        </p>
      </CardContent>
    </Card>
  );
}
