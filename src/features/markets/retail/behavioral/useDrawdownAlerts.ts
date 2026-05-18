// src/features/markets/retail/behavioral/useDrawdownAlerts.ts
import { useMemo } from 'react';
import type { AlertTier, DrawdownState } from './types';

/** Pure function — computable without React. Used in tests. */
export function computeDrawdownState(currentNav: number, peakNav: number): DrawdownState {
  if (peakNav <= 0) {
    return { currentNav, peakNav, drawdownPct: 0, alertTier: null };
  }
  const drawdownPct = ((peakNav - currentNav) / peakNav) * 100;
  let alertTier: AlertTier = null;
  if (drawdownPct >= 20)       alertTier = 'red';
  else if (drawdownPct >= 10)  alertTier = 'orange';
  else if (drawdownPct >= 5)   alertTier = 'yellow';
  return { currentNav, peakNav, drawdownPct, alertTier };
}

interface PnLPoint { nav: number; [key: string]: unknown }
interface PnLData {
  series: PnLPoint[];
  summary: { current_nav: number; [key: string]: unknown };
}

/** React hook — derives peak NAV from the P&L time series. */
export function useDrawdownState(pnlData: PnLData | undefined): DrawdownState {
  return useMemo(() => {
    const series = pnlData?.series ?? [];
    const currentNav = pnlData?.summary.current_nav ?? 0;
    const peakNav = series.length > 0
      ? Math.max(...series.map((p) => p.nav))
      : currentNav;
    return computeDrawdownState(currentNav, peakNav);
  }, [pnlData]);
}
