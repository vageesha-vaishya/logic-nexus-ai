/**
 * PortfolioChartsModal — full-height Sheet wrapping the existing
 * desktop PortfolioPnLChart for mobile users.
 *
 * The chart is built on lightweight-charts (already in the bundle —
 * see PortfolioPnLChart.tsx). It already has its own timeframe
 * switcher (1M/3M/6M/1Y/All) and handles its own data fetching via
 * usePortfolioPnL. We just give it a properly-sized container.
 *
 * Slice 3 of the mobile portfolio detail surface
 * (see session analysis 2026-05-26).
 */
import { X } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/design-system";
import { SheetDescription } from "@/components/ui/sheet";

import { PortfolioPnLChart } from "../../components/PortfolioPnLChart";

export interface PortfolioChartsModalProps {
  portfolioId: string | undefined;
  portfolioName?: string | null;
  open:  boolean;
  onClose: () => void;
}

export function PortfolioChartsModal({
  portfolioId, portfolioName, open, onClose,
}: PortfolioChartsModalProps) {
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="bottom"
        className="h-[92vh] overflow-y-auto rounded-t-xl p-4"
      >
        <SheetHeader className="flex flex-row items-start justify-between gap-2">
          <div className="min-w-0">
            <SheetTitle className="truncate">
              {portfolioName ? `${portfolioName} — Performance` : "Performance"}
            </SheetTitle>
            <SheetDescription className="text-xs">
              NAV vs cost over time. Pinch to zoom, drag to pan.
            </SheetDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-muted-foreground hover:bg-accent shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </SheetHeader>

        <div className="mt-4">
          {open && portfolioId ? (
            <PortfolioPnLChart portfolioId={portfolioId} />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
