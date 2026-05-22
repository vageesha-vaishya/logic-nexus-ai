/**
 * Coach-marked first-Home tour — sequential overlays the wizard ends with
 * (design decision 13e). Five short steps, each anchored to a Home-tab
 * element via data-tour-id. Skippable at any point; tour_completed flag
 * persists so we never re-run.
 *
 * Per design doc §"End-to-end flow":
 *   4–5 sequential overlays (Signals, Risk Score, News, Portfolio, More).
 */

export type TourAnchorId =
  | 'dashboard'
  | 'risk-score'
  | 'news'
  | 'tab-signals'
  | 'tab-more';

export interface TourStep {
  anchor:    TourAnchorId;
  title:     string;
  body:      string;
  /** Tooltip placement relative to the anchor. */
  placement: 'bottom' | 'top' | 'right';
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    anchor:    'dashboard',
    title:     'Your portfolio at a glance',
    body:      'Total value, tier split, and goal progress live here. The numbers update through the day.',
    placement: 'bottom',
  },
  {
    anchor:    'risk-score',
    title:     'Daily 0–10 risk score',
    body:      'We score your portfolio every day against your target. Tap it to see what drove the score and run a stress test.',
    placement: 'bottom',
  },
  {
    anchor:    'news',
    title:     'News about your holdings',
    body:      'Headlines for the stocks and ETFs you hold, refreshed every few hours.',
    placement: 'top',
  },
  {
    anchor:    'tab-signals',
    title:     'Trading signals',
    body:      'Signals matched to your risk tag and goal horizons. We never auto-trade — you decide.',
    placement: 'top',
  },
  {
    anchor:    'tab-more',
    title:     'Settings & broker',
    body:      'Connect a broker (Zerodha / Fyers), set up nominees, or change your risk profile from here.',
    placement: 'top',
  },
] as const;
