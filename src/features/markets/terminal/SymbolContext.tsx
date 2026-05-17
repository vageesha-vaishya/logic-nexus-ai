/**
 * SymbolContext — shared symbol state for terminal panels.
 *
 * Clicking a symbol in the Watchlist panel syncs the Chart,
 * Market Depth, and Order Form panels via this context.
 */

import { createContext, useContext, useState, type ReactNode } from "react";

interface SymbolContextValue {
  symbol: string;
  exchange: string;
  setSymbol: (symbol: string, exchange?: string) => void;
}

const SymbolContext = createContext<SymbolContextValue>({
  symbol: "NIFTY 50",
  exchange: "NSE",
  setSymbol: () => undefined,
});

interface SymbolProviderProps {
  children: ReactNode;
  initialSymbol?: string;
  initialExchange?: string;
}

export function SymbolProvider({
  children,
  initialSymbol = "NIFTY 50",
  initialExchange = "NSE",
}: SymbolProviderProps) {
  const [symbol, setSymbolState] = useState(initialSymbol);
  const [exchange, setExchangeState] = useState(initialExchange);

  function setSymbol(newSymbol: string, newExchange = "NSE") {
    setSymbolState(newSymbol);
    setExchangeState(newExchange);
  }

  return (
    <SymbolContext.Provider value={{ symbol, exchange, setSymbol }}>
      {children}
    </SymbolContext.Provider>
  );
}

export function useSymbol() {
  return useContext(SymbolContext);
}
