/**
 * ChartPanel — trading chart panel for the terminal workspace.
 * Wraps TradingChart with a compact symbol selector.
 */

import { useState } from "react";
import { TradingChart } from "../../components/TradingChart";
import { useSymbol } from "../SymbolContext";

interface ChartPanelProps {
  symbol?: string;
  exchange?: string;
  height: number;
}

const QUICK_SYMBOLS = [
  "NIFTY 50",
  "NIFTY BANK",
  "SENSEX",
  "RELIANCE",
  "HDFCBANK",
  "INFY",
  "TCS",
  "WIPRO",
];

export function ChartPanel({ symbol: propSymbol, exchange: propExchange, height }: ChartPanelProps) {
  const { symbol: ctxSymbol, exchange: ctxExchange, setSymbol } = useSymbol();

  // Panel can be linked to global symbol or have its own override
  const [localSymbol, setLocalSymbol] = useState<string | null>(propSymbol ?? null);
  const activeSymbol = localSymbol ?? ctxSymbol;
  const activeExchange = propExchange ?? ctxExchange;

  function handleSymbolSelect(sym: string) {
    setLocalSymbol(sym);
    setSymbol(sym, activeExchange);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Compact symbol pills */}
      <div className="flex items-center gap-1 px-1 pb-1 flex-wrap shrink-0">
        {QUICK_SYMBOLS.map((sym) => (
          <button
            key={sym}
            onClick={() => handleSymbolSelect(sym)}
            className={[
              "px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors",
              activeSymbol === sym
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted",
            ].join(" ")}
          >
            {sym}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <TradingChart
          symbol={activeSymbol}
          exchange={activeExchange}
          height={height - 28}
          className="h-full"
        />
      </div>
    </div>
  );
}
