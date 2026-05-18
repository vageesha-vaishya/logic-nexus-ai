import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OrderFormSheet } from '@/features/markets/components/OrderFormSheet';
import { useActiveConnection } from '@/features/markets/hooks/useActiveConnection';
import type { RetailSignal } from '../types';

interface ExecutionBottomSheetProps {
  signal: RetailSignal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExecutionBottomSheet({
  signal,
  open,
  onOpenChange,
}: ExecutionBottomSheetProps) {
  const { connection, hasTradeableConnection } = useActiveConnection();
  const [orderOpen, setOrderOpen] = useState(false);

  if (!signal) return null;

  const { instrument, signal_type, confidence = 0, price_at_signal } = signal;
  const symbol = instrument?.symbol ?? '—';
  const side = signal_type === 'buy' ? 'BUY' : 'SELL';

  const handleProceed = () => {
    onOpenChange(false);
    setOrderOpen(true);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-xl max-h-[70vh]">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-base">Confirm trade</SheetTitle>
          </SheetHeader>

          <div className="space-y-4">
            {/* Signal summary */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{symbol}</span>
                <Badge
                  variant={side === 'BUY' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {side}
                </Badge>
              </div>
              <div className="text-right">
                {price_at_signal && (
                  <p className="text-sm font-medium">
                    ₹{price_at_signal.toLocaleString('en-IN')}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Confidence {Math.round((confidence ?? 0) * 100)}%
                </p>
              </div>
            </div>

            {/* SEBI mandatory disclaimer */}
            <p className="text-xs text-muted-foreground leading-relaxed">
              Past performance is not indicative of future results. This signal is
              for informational purposes only and does not constitute investment
              advice. Invest only what you can afford to lose.
            </p>

            {/* Proceed button */}
            <Button
              className="w-full"
              variant={side === 'BUY' ? 'default' : 'destructive'}
              onClick={handleProceed}
              disabled={!connection}
            >
              {connection
                ? `Proceed to place order`
                : 'Connect broker to trade'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Full order form — opened after user confirms in the sheet */}
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
