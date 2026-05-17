import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { OrderFormSheet } from "./OrderFormSheet";
import { useActiveConnection } from "../hooks/useActiveConnection";

interface QuickTradeButtonProps {
  symbol: string;
  exchange?: string;
  size?: "sm" | "default";
  className?: string;
}

export function QuickTradeButton({
  symbol,
  exchange = "NSE",
  size = "sm",
  className,
}: QuickTradeButtonProps) {
  const navigate = useNavigate();
  const { connection, hasTradeableConnection, isLoading } = useActiveConnection();
  const [sheet, setSheet] = useState<{ open: boolean; side: "BUY" | "SELL" } | null>(null);

  if (isLoading) return null;

  if (!connection) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className={cn("text-xs text-muted-foreground", className)}
        onClick={() => {
          toast.info("Connect a broker to place live orders", {
            action: {
              label: "Connect",
              onClick: () => navigate("/dashboard/markets/settings/brokers"),
            },
          });
        }}
      >
        Trade
      </Button>
    );
  }

  const label = (side: "BUY" | "SELL") =>
    size === "default" ? side : side === "BUY" ? "B" : "S";

  return (
    <>
      <div className={cn("inline-flex items-center gap-1", className)}>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-xs font-semibold text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-950"
          onClick={(e) => { e.stopPropagation(); setSheet({ open: true, side: "BUY" }); }}
          title={`Buy ${symbol}`}
        >
          {label("BUY")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-xs font-semibold text-rose-600 border-rose-300 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-700 dark:hover:bg-rose-950"
          onClick={(e) => { e.stopPropagation(); setSheet({ open: true, side: "SELL" }); }}
          title={`Sell ${symbol}`}
        >
          {label("SELL")}
        </Button>
      </div>

      {sheet && (
        <OrderFormSheet
          open={sheet.open}
          onOpenChange={(open) => setSheet(open ? sheet : null)}
          connectionId={connection.id}
          connectionName={connection.display_name}
          brokerName={connection.broker}
          canTrade={hasTradeableConnection}
          defaultSymbol={symbol}
          defaultExchange={exchange}
          defaultTransactionType={sheet.side}
        />
      )}
    </>
  );
}
