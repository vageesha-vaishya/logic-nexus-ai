import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import { OrderFormSheet } from '../../components/OrderFormSheet';
import { useActiveConnection } from '../../hooks/useActiveConnection';
import type { RetailSignal } from '../types';

interface ExecutionBottomSheetProps {
  signal: RetailSignal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Two-step trade confirmation:
 *   1. Bottom sheet shows the signal summary + SEBI-mandated disclaimer.
 *   2. Tapping "Proceed" closes this sheet and opens the canonical
 *      OrderFormSheet (the same form QuickTradeButton uses), pre-filled with
 *      symbol/exchange/side.
 *
 * The disclaimer text is intentionally explicit per SEBI's investor-protection
 * guidance for retail-facing trading apps.
 */
export function ExecutionBottomSheet({ signal, open, onOpenChange }: ExecutionBottomSheetProps) {
  const { connection, hasTradeableConnection } = useActiveConnection();
  const [orderOpen, setOrderOpen] = useState(false);

  if (!signal) return null;

  const { instrument, signal_type } = signal;
  const confidence = signal.confidence ?? 0;
  const priceAtSignal = signal.price_at_signal;
  const symbol = instrument?.symbol ?? '—';

  const isBuy  = signal_type === 'buy';
  const isSell = signal_type === 'sell';
  const side: 'BUY' | 'SELL' = isSell ? 'SELL' : 'BUY';

  const canProceed = Boolean(connection) && (isBuy || isSell);

  const handleProceed = () => {
    onOpenChange(false);
    setOrderOpen(true);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[70vh] rounded-t-xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-base">Confirm trade</SheetTitle>
            <SheetDescription className="sr-only">
              Review the signal details and disclaimer before placing a broker order.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
              <div className="min-w-0">
                <span className="font-semibold">{symbol}</span>
                <Badge
                  variant={side === 'BUY' ? 'default' : 'destructive'}
                  className="ml-2 text-xs"
                >
                  {side}
                </Badge>
              </div>
              <div className="text-right">
                {priceAtSignal != null && (
                  <p className="text-sm font-medium tabular-nums">
                    ₹{priceAtSignal.toLocaleString('en-IN')}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Confidence {Math.round(confidence * 100)}%
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Past performance is not indicative of future results. This signal is
              for informational purposes only and does not constitute investment
              advice. Invest only what you can afford to lose.
            </p>

            <Button
              className="w-full"
              variant={side === 'BUY' ? 'default' : 'destructive'}
              onClick={handleProceed}
              disabled={!canProceed}
            >
              {!connection
                ? 'Connect a broker to trade'
                : !canProceed
                ? 'Signal not actionable'
                : `Proceed to ${side}`}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {connection && (
        <OrderFormSheet
          open={orderOpen}
          onOpenChange={setOrderOpen}
          connectionId={connection.id}
          connectionName={connection.display_name}
          brokerName={connection.broker}
          canTrade={hasTradeableConnection}
          defaultSymbol={symbol}
          defaultExchange={instrument?.exchange ?? 'NSE'}
          defaultTransactionType={side}
        />
      )}
    </>
  );
}
