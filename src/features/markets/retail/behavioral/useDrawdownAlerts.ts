/**
 * Drawdown alerts — derives a Yellow / Orange / Red alert tier from a
 * portfolio's NAV series.
 *
 * Thresholds (loss-aversion ladder):
 *   ≥  5%  → yellow ("markets are moving today")
 *   ≥ 10%  → orange ("portfolio down from peak — context on recovery")
 *   ≥ 20%  → red   (mandatory cooling-off screen before a panic sell)
 *
 * Yellow + Orange render BehavioralAlertBanner (Task 6).
 * Red triggers CoolingOffScreen (Task 7) — never blocks, always informs.
 */
import { useMemo } from 'react';

import type { PnLData } from '../../hooks/usePortfolioPnL';
import type { AlertTier, DrawdownState } from './types';

const YELLOW_THRESHOLD_PCT = 5;
const ORANGE_THRESHOLD_PCT = 10;
const RED_THRESHOLD_PCT    = 20;

/** Pure function — exported for testing. */
export function computeDrawdownState(currentNav: number, peakNav: number): DrawdownState {
  if (peakNav <= 0) {
    return { currentNav, peakNav, drawdownPct: 0, alertTier: null };
  }
  const drawdownPct = ((peakNav - currentNav) / peakNav) * 100;

  let alertTier: AlertTier = null;
  if (drawdownPct >= RED_THRESHOLD_PCT)         alertTier = 'red';
  else if (drawdownPct >= ORANGE_THRESHOLD_PCT) alertTier = 'orange';
  else if (drawdownPct >= YELLOW_THRESHOLD_PCT) alertTier = 'yellow';

  return { currentNav, peakNav, drawdownPct, alertTier };
}

/** Memoised over the entire pnlData object — recomputes only when series/summary changes. */
export function useDrawdownState(pnlData: PnLData | undefined): DrawdownState {
  return useMemo(() => {
    const series     = pnlData?.series ?? [];
    const currentNav = pnlData?.summary.current_nav ?? 0;
    const peakNav    = series.length > 0
      ? Math.max(...series.map((p) => p.nav))
      : currentNav;
    return computeDrawdownState(currentNav, peakNav);
  }, [pnlData]);
}
