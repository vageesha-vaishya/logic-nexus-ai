// src/features/markets/retail/community/CommunityHub.tsx
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BasketDiscovery } from './BasketDiscovery';
import { BasketDetail } from './BasketDetail';
import { BasketCreator } from './BasketCreator';
import { StrategyMarketplace } from './StrategyMarketplace';
import { CopyTradingExtended } from './CopyTradingExtended';
import type { CommunityBasket } from './types';

export function CommunityHub() {
  const [selectedBasket, setSelectedBasket] = useState<CommunityBasket | null>(null);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">Community</h3>

      <Tabs defaultValue="baskets">
        <TabsList className="w-full">
          <TabsTrigger value="baskets" className="flex-1 text-xs">Baskets</TabsTrigger>
          <TabsTrigger value="strategies" className="flex-1 text-xs">Strategies</TabsTrigger>
          <TabsTrigger value="copy" className="flex-1 text-xs">Copy Trade</TabsTrigger>
          <TabsTrigger value="create" className="flex-1 text-xs">Create</TabsTrigger>
        </TabsList>

        <TabsContent value="baskets">
          {selectedBasket ? (
            <BasketDetail basket={selectedBasket} onBack={() => setSelectedBasket(null)} />
          ) : (
            <BasketDiscovery onSelect={setSelectedBasket} />
          )}
        </TabsContent>

        <TabsContent value="strategies">
          <StrategyMarketplace />
        </TabsContent>

        <TabsContent value="copy">
          <CopyTradingExtended />
        </TabsContent>

        <TabsContent value="create">
          <BasketCreator />
        </TabsContent>
      </Tabs>
    </div>
  );
}
