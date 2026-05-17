/**
 * useTradingMode — persisted novice / expert toggle.
 *
 * Stored in localStorage under "lnai_trading_mode".
 * Default: "novice"
 *
 * Novice: simplified view — beginner-friendly layouts and guided hints.
 * Expert: full feature set — advanced order types, Greeks, all indicators.
 */

import { useState } from "react";

export type TradingMode = "novice" | "expert";

const STORAGE_KEY = "lnai_trading_mode";

export function useTradingMode(): [TradingMode, (mode: TradingMode) => void] {
  const [mode, setModeState] = useState<TradingMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "novice" || stored === "expert") return stored;
    return "novice";
  });

  const setMode = (m: TradingMode) => {
    localStorage.setItem(STORAGE_KEY, m);
    setModeState(m);
  };

  return [mode, setMode];
}
