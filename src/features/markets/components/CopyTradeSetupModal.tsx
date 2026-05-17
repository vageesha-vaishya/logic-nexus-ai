/**
 * CopyTradeSetupModal — starts copying a trader.
 *
 * Props:
 *   open         — controls Dialog visibility
 *   onClose      — called on cancel / success
 *   traderId     — UUID of the trader to copy
 *   traderLabel  — optional display label (falls back to last-8 of traderId)
 */

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { Slider } from "@/components/ui/slider";
import { useStartCopying, usePortfolios } from "../hooks/useCopyTrades";

interface CopyTradeSetupModalProps {
  open: boolean;
  onClose: () => void;
  traderId: string;
  traderLabel?: string;
}

const ALLOCATION_MIN = 5;
const ALLOCATION_MAX = 50;
const ALLOCATION_STEP = 5;
const ALLOCATION_DEFAULT = 10;

// Rough paper balance placeholder — shown as "Up to ₹X per trade".
// The real balance would come from a portfolio balance query; we use a
// simple estimate here to avoid an extra fetch in a modal.
const PAPER_BALANCE_ESTIMATE = 100_000;

export function CopyTradeSetupModal({
  open,
  onClose,
  traderId,
  traderLabel,
}: CopyTradeSetupModalProps) {
  const [portfolioId, setPortfolioId] = useState<string>("");
  const [allocationPct, setAllocationPct] = useState<number>(ALLOCATION_DEFAULT);

  const { data: portfolios = [], isLoading: loadingPortfolios } = usePortfolios();
  const paperPortfolios = portfolios.filter((p) => p.portfolio_type === "paper");

  const startCopying = useStartCopying();

  // Reset state when modal reopens
  useEffect(() => {
    if (open) {
      setPortfolioId("");
      setAllocationPct(ALLOCATION_DEFAULT);
    }
  }, [open]);

  // Auto-select the first paper portfolio when list loads
  useEffect(() => {
    if (paperPortfolios.length > 0 && !portfolioId) {
      setPortfolioId(paperPortfolios[0].id);
    }
  }, [paperPortfolios, portfolioId]);

  const displayLabel =
    traderLabel ?? `@trader_${traderId.slice(-8)}`;

  const estimatedAmount = Math.round(
    (PAPER_BALANCE_ESTIMATE * allocationPct) / 100,
  );

  const handleSubmit = async () => {
    if (!portfolioId) {
      toast.error("Please select a paper portfolio");
      return;
    }
    try {
      await startCopying.mutateAsync({
        trader_id: traderId,
        paper_portfolio_id: portfolioId,
        allocation_pct: allocationPct,
      });
      toast.success(`Now copying ${displayLabel}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start copying");
    }
  };

  const hasPaperPortfolios = paperPortfolios.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy Trader</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Trader label */}
          <div className="rounded-md bg-muted/50 px-4 py-3">
            <span className="text-xs text-muted-foreground">Copying</span>
            <p className="mt-0.5 font-semibold">{displayLabel}</p>
          </div>

          {/* Portfolio selector */}
          <div className="space-y-2">
            <Label htmlFor="portfolio-select">Paper Portfolio</Label>
            {loadingPortfolios ? (
              <div className="flex h-10 items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading portfolios…
              </div>
            ) : !hasPaperPortfolios ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-400">
                No paper portfolio found. Create one first in{" "}
                <a
                  href="/dashboard/markets/portfolios"
                  className="underline underline-offset-2"
                >
                  Portfolios
                </a>
                .
              </p>
            ) : (
              <Select value={portfolioId} onValueChange={setPortfolioId}>
                <SelectTrigger id="portfolio-select">
                  <SelectValue placeholder="Select a paper portfolio" />
                </SelectTrigger>
                <SelectContent>
                  {paperPortfolios.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Allocation slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Allocation per trade</Label>
              <span className="text-sm font-semibold tabular-nums">
                {allocationPct}%
              </span>
            </div>
            <Slider
              min={ALLOCATION_MIN}
              max={ALLOCATION_MAX}
              step={ALLOCATION_STEP}
              value={[allocationPct]}
              onValueChange={([v]) => setAllocationPct(v)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{ALLOCATION_MIN}%</span>
              <span>{ALLOCATION_MAX}%</span>
            </div>
          </div>

          {/* Preview */}
          {hasPaperPortfolios && portfolioId && (
            <p className="rounded-md bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
              Up to{" "}
              <span className="font-semibold text-foreground">
                ₹{estimatedAmount.toLocaleString("en-IN")}
              </span>{" "}
              per trade based on your paper balance estimate
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={startCopying.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              startCopying.isPending ||
              !hasPaperPortfolios ||
              !portfolioId ||
              loadingPortfolios
            }
          >
            {startCopying.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting…
              </>
            ) : (
              "Start Copying"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
