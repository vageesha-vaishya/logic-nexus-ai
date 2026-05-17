/**
 * OptionChainPanel — option chain panel for the terminal workspace.
 * Wraps the existing OptionChainTable with a compact underlying + expiry selector.
 */

import { useState } from "react";
import { useFnoUnderlyings, useOptionChain } from "../../hooks/useFno";
import { OptionChainTable } from "../../components/OptionChainTable";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { cn } from "@/lib/utils";

export function OptionChainPanel() {
  const [underlying, setUnderlying] = useState("NIFTY 50");
  const [expiry, setExpiry] = useState("");

  const { data: underlyings, isLoading: underlyingsLoading } = useFnoUnderlyings();
  const { data: chain, isLoading: chainLoading } = useOptionChain(underlying, expiry);

  // Set expiry once chain loads for the first time
  if (chain && !expiry && chain.expiries.length > 0) {
    setExpiry(chain.expiries[0]);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header: underlying + expiry selector */}
      <div className="flex items-center gap-2 px-1 pb-1 shrink-0 flex-wrap">
        <Select value={underlying} onValueChange={setUnderlying}>
          <SelectTrigger className="h-7 w-36 text-xs font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {underlyingsLoading && (
              <SelectItem value="NIFTY 50" disabled>Loading…</SelectItem>
            )}
            {(underlyings ?? []).map((u) => (
              <SelectItem key={u.symbol} value={u.symbol} className="text-xs font-mono">
                {u.symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {chain && (
          <div className="flex gap-1 flex-wrap">
            {chain.expiries.slice(0, 4).map((exp) => (
              <button
                key={exp}
                onClick={() => setExpiry(exp)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-mono transition-colors",
                  expiry === exp
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted",
                )}
              >
                {exp}
              </button>
            ))}
          </div>
        )}

        {chain && (
          <div className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
            {chain.spot > 0 && (
              <span>
                Spot:{" "}
                <span className="text-foreground font-semibold">
                  ₹{chain.spot.toLocaleString("en-IN")}
                </span>
              </span>
            )}
            {chain.pcr != null && (
              <span>
                PCR:{" "}
                <span
                  className={cn(
                    "font-semibold",
                    chain.pcr > 1.2
                      ? "text-emerald-500"
                      : chain.pcr < 0.8
                      ? "text-red-500"
                      : "text-foreground",
                  )}
                >
                  {chain.pcr.toFixed(2)}
                </span>
              </span>
            )}
            {chain.max_pain != null && (
              <span>
                MaxPain:{" "}
                <span className="text-foreground font-semibold">
                  {chain.max_pain.toLocaleString("en-IN")}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Chain table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {chainLoading && (
          <div className="flex flex-col gap-1.5 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full rounded" />
            ))}
          </div>
        )}

        {!chainLoading && chain && (
          <OptionChainTable chain={chain} showGreeks={false} />
        )}

        {!chainLoading && !chain && (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            Select an underlying to load option chain
          </div>
        )}
      </div>
    </div>
  );
}
