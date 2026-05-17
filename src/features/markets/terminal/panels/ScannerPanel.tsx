/**
 * ScannerPanel — compact market scanner panel for the terminal workspace.
 * Filter preset buttons + results list below. Symbol click syncs linked panels.
 */

import { useState } from "react";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { useScanner, type ScanFilter } from "../../hooks/useScanner";
import { useSymbol } from "../SymbolContext";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface FilterPreset {
  label: string;
  filters: ScanFilter[];
  icon: React.ReactNode;
}

const PRESETS: FilterPreset[] = [
  {
    label: "Strong Buy",
    filters: ["strong_buy"],
    icon: <TrendingUp className="h-3 w-3" />,
  },
  {
    label: "Strong Sell",
    filters: ["strong_sell"],
    icon: <TrendingDown className="h-3 w-3" />,
  },
  {
    label: "RSI Oversold",
    filters: ["rsi_oversold"],
    icon: <Activity className="h-3 w-3" />,
  },
  {
    label: "52W High",
    filters: ["near_52w_high"],
    icon: <TrendingUp className="h-3 w-3" />,
  },
  {
    label: "52W Low",
    filters: ["near_52w_low"],
    icon: <TrendingDown className="h-3 w-3" />,
  },
  {
    label: "MACD Bull",
    filters: ["macd_bullish"],
    icon: <Activity className="h-3 w-3" />,
  },
];

export function ScannerPanel() {
  const [activePreset, setActivePreset] = useState<FilterPreset>(PRESETS[0]);
  const { setSymbol } = useSymbol();

  const { data, isLoading, isError } = useScanner(activePreset.filters, "any");

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Filter preset buttons */}
      <div className="flex flex-wrap gap-1 px-1 pb-1 shrink-0">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => setActivePreset(preset)}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
              activePreset.label === preset.label
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted",
            )}
          >
            {preset.icon}
            {preset.label}
          </button>
        ))}
      </div>

      {/* Result count */}
      {data && (
        <div className="px-2 pb-1 shrink-0 text-[10px] text-muted-foreground">
          {data.total_matched} matches from {data.total_scanned} scanned
        </div>
      )}

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-1 px-2 pb-0.5 shrink-0">
        <span className="text-[9px] text-muted-foreground font-medium">SYMBOL</span>
        <span className="text-[9px] text-muted-foreground font-medium text-right w-16">LTP</span>
        <span className="text-[9px] text-muted-foreground font-medium text-right w-12">CHG%</span>
        <span className="text-[9px] text-muted-foreground font-medium text-right w-10">SCORE</span>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading && (
          <div className="flex flex-col gap-1 p-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full rounded" />
            ))}
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground text-center px-4">
            Scanner unavailable. Start the markets worker.
          </div>
        )}

        {!isLoading && !isError && data && data.results.length === 0 && (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
            No matches for this filter
          </div>
        )}

        {!isLoading &&
          !isError &&
          data?.results.map((result) => {
            const changePct = result.change_pct ?? null;
            const isUp = changePct != null && changePct > 0;
            const isDown = changePct != null && changePct < 0;

            return (
              <button
                key={`${result.symbol}-${result.exchange}`}
                onClick={() => setSymbol(result.symbol, result.exchange)}
                className="w-full grid grid-cols-[1fr_auto_auto_auto] gap-x-1 px-2 py-0.5 rounded hover:bg-muted/50 transition-colors text-left"
              >
                <span className="text-xs font-mono truncate">{result.symbol}</span>
                <span className="text-xs font-mono tabular-nums text-right w-16">
                  {result.ltp != null
                    ? result.ltp.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "—"}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-mono tabular-nums text-right w-12",
                    isUp ? "text-emerald-500" : isDown ? "text-red-500" : "text-muted-foreground",
                  )}
                >
                  {changePct != null
                    ? `${isUp ? "+" : ""}${changePct.toFixed(2)}%`
                    : "—"}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-mono tabular-nums text-right w-10",
                    result.direction === "buy"
                      ? "text-emerald-500"
                      : result.direction === "sell"
                      ? "text-red-500"
                      : "text-muted-foreground",
                  )}
                >
                  {result.score.toFixed(0)}
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
