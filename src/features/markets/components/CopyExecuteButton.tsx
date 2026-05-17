/**
 * CopyExecuteButton — one-tap copy execution for IdeaCard / IdeaDetailPage.
 *
 * Props:
 *   ideaId           — the trade idea being executed
 *   symbol           — instrument symbol (for toast message)
 *   direction        — 'bullish' | 'bearish' | 'neutral'
 *   authorId         — user_id of the idea author
 *   activeCopyTradeId — if set, user has an active copy relationship with this author
 */

import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/design-system";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/design-system";
import { useExecuteCopyTrade } from "../hooks/useCopyTrades";

interface CopyExecuteButtonProps {
  ideaId: string;
  symbol?: string;
  direction: string;
  authorId: string;
  activeCopyTradeId?: string;
}

export function CopyExecuteButton({
  ideaId,
  symbol,
  direction,
  activeCopyTradeId,
}: CopyExecuteButtonProps) {
  const executeMutation = useExecuteCopyTrade();

  const isNeutral = direction === "neutral";
  const hasActiveCopy = Boolean(activeCopyTradeId);

  const side: "BUY" | "SELL" | null =
    direction === "bullish" ? "BUY" :
    direction === "bearish" ? "SELL" :
    null;

  const isDisabled = isNeutral || !hasActiveCopy || !side || executeMutation.isPending;

  const handleClick = async () => {
    if (!activeCopyTradeId || !side) return;

    try {
      const result = await executeMutation.mutateAsync({
        id: activeCopyTradeId,
        idea_id: ideaId,
        side,
      });

      const sym = result.symbol ?? symbol ?? "?";
      const verb = side === "BUY" ? "Bought" : "Sold";
      toast.success(
        `Copied! ${verb} ${result.quantity} share${result.quantity !== 1 ? "s" : ""} of ${sym} at ₹${result.price.toLocaleString("en-IN")}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Copy execution failed");
    }
  };

  const tooltipText = isNeutral
    ? "Neutral — no direction to copy"
    : !hasActiveCopy
    ? "Not copying this trader"
    : undefined;

  const buttonVariant = side === "BUY" ? "default" : side === "SELL" ? "destructive" : "outline";

  const buttonClassName =
    side === "BUY"
      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
      : side === "SELL"
      ? "bg-rose-600 hover:bg-rose-700 text-white"
      : "";

  const Icon = side === "BUY" ? TrendingUp : side === "SELL" ? TrendingDown : null;

  const button = (
    <Button
      variant={isDisabled ? "outline" : buttonVariant}
      size="sm"
      className={`h-7 gap-1 text-xs ${!isDisabled ? buttonClassName : ""}`}
      onClick={handleClick}
      disabled={isDisabled}
    >
      {executeMutation.isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        Icon && <Icon className="h-3 w-3" />
      )}
      Copy Execute
    </Button>
  );

  if (tooltipText) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
