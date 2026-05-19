/**
 * optionsPayoff.ts — Pure options strategy payoff math utilities.
 *
 * All functions are stateless and side-effect-free.
 * Used by the Options Strategy Payoff Builder page.
 *
 * Route: /dashboard/markets/options-payoff
 */

export type OptionType = 'call' | 'put';
export type OptionSide = 'long' | 'short';

export interface Leg {
  id: string;
  type: OptionType;
  side: OptionSide;
  strike: number;      // strike price
  premium: number;     // premium paid/received per unit
  lots: number;        // number of lots
  lotSize: number;     // lot size (default 50 for NIFTY)
}

/** Payoff of a single leg at expiry for underlying price S */
export function legPayoff(leg: Leg, S: number): number {
  const intrinsic =
    leg.type === 'call'
      ? Math.max(S - leg.strike, 0)
      : Math.max(leg.strike - S, 0);
  const perUnit =
    leg.side === 'long' ? intrinsic - leg.premium : leg.premium - intrinsic;
  return perUnit * leg.lots * leg.lotSize;
}

/** Total strategy payoff across all legs at price S */
export function strategyPayoff(legs: Leg[], S: number): number {
  return legs.reduce((sum, leg) => sum + legPayoff(leg, S), 0);
}

/**
 * Generate payoff curve: array of {price, pnl} from spotMin to spotMax.
 * Returns `steps + 1` points.
 */
export function payoffCurve(
  legs: Leg[],
  spotMin: number,
  spotMax: number,
  steps = 200,
): { price: number; pnl: number }[] {
  const step = (spotMax - spotMin) / steps;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const price = spotMin + i * step;
    return {
      price: Math.round(price),
      pnl: Math.round(strategyPayoff(legs, price)),
    };
  });
}

/** Computed risk/reward metrics for a strategy */
export interface StrategyMetrics {
  maxProfit: number;
  maxLoss: number;
  netPremium: number;
  breakevenPoints: number[];
}

/** Compute key metrics from a strategy over the given spot range */
export function strategyMetrics(
  legs: Leg[],
  spotMin: number,
  spotMax: number,
): StrategyMetrics {
  const curve = payoffCurve(legs, spotMin, spotMax, 1000);
  const maxProfit = Math.max(...curve.map((p) => p.pnl));
  const maxLoss = Math.min(...curve.map((p) => p.pnl));

  // Net premium: sum of (premium * lots * lotSize * sign)
  const netPremium = legs.reduce(
    (sum, l) =>
      sum + (l.side === 'long' ? -1 : 1) * l.premium * l.lots * l.lotSize,
    0,
  );

  // Breakeven points: where payoff crosses zero
  const breakevenPoints: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1];
    const curr = curve[i];
    if (
      (prev.pnl < 0 && curr.pnl >= 0) ||
      (prev.pnl >= 0 && curr.pnl < 0)
    ) {
      // Linear interpolation for a more accurate crossing estimate
      const denom = curr.pnl - prev.pnl;
      if (denom === 0) continue;
      const x =
        prev.price + ((0 - prev.pnl) * (curr.price - prev.price)) / denom;
      breakevenPoints.push(Math.round(x));
    }
  }

  return { maxProfit, maxLoss, netPremium, breakevenPoints };
}

// ── Preset strategy factories ──────────────────────────────────────────────────

/**
 * STRATEGY_PRESETS maps a human-readable name to a factory function.
 * Each factory takes the current spot price and lot size, and returns
 * an array of fully-configured Leg objects (without IDs — callers add UUIDs).
 */
export type StrategyPresetFactory = (spot: number, lotSize: number) => Omit<Leg, 'id'>[];

export const STRATEGY_PRESETS: Record<string, StrategyPresetFactory> = {
  'Long Call': (spot, ls) => [
    {
      type: 'call',
      side: 'long',
      strike: Math.round(spot / 50) * 50,
      premium: 100,
      lots: 1,
      lotSize: ls,
    },
  ],

  'Long Put': (spot, ls) => [
    {
      type: 'put',
      side: 'long',
      strike: Math.round(spot / 50) * 50,
      premium: 100,
      lots: 1,
      lotSize: ls,
    },
  ],

  'Bull Call Spread': (spot, ls) => {
    const atm = Math.round(spot / 50) * 50;
    return [
      { type: 'call', side: 'long',  strike: atm,       premium: 150, lots: 1, lotSize: ls },
      { type: 'call', side: 'short', strike: atm + 100, premium: 80,  lots: 1, lotSize: ls },
    ];
  },

  'Bear Put Spread': (spot, ls) => {
    const atm = Math.round(spot / 50) * 50;
    return [
      { type: 'put', side: 'long',  strike: atm,       premium: 150, lots: 1, lotSize: ls },
      { type: 'put', side: 'short', strike: atm - 100, premium: 80,  lots: 1, lotSize: ls },
    ];
  },

  'Long Straddle': (spot, ls) => {
    const atm = Math.round(spot / 50) * 50;
    return [
      { type: 'call', side: 'long', strike: atm, premium: 130, lots: 1, lotSize: ls },
      { type: 'put',  side: 'long', strike: atm, premium: 120, lots: 1, lotSize: ls },
    ];
  },

  'Short Straddle': (spot, ls) => {
    const atm = Math.round(spot / 50) * 50;
    return [
      { type: 'call', side: 'short', strike: atm, premium: 130, lots: 1, lotSize: ls },
      { type: 'put',  side: 'short', strike: atm, premium: 120, lots: 1, lotSize: ls },
    ];
  },

  'Long Strangle': (spot, ls) => {
    const atm = Math.round(spot / 50) * 50;
    return [
      { type: 'call', side: 'long', strike: atm + 100, premium: 80, lots: 1, lotSize: ls },
      { type: 'put',  side: 'long', strike: atm - 100, premium: 70, lots: 1, lotSize: ls },
    ];
  },

  'Iron Condor': (spot, ls) => {
    const atm = Math.round(spot / 50) * 50;
    return [
      { type: 'put',  side: 'long',  strike: atm - 200, premium: 30,  lots: 1, lotSize: ls },
      { type: 'put',  side: 'short', strike: atm - 100, premium: 70,  lots: 1, lotSize: ls },
      { type: 'call', side: 'short', strike: atm + 100, premium: 80,  lots: 1, lotSize: ls },
      { type: 'call', side: 'long',  strike: atm + 200, premium: 35,  lots: 1, lotSize: ls },
    ];
  },

  'Iron Butterfly': (spot, ls) => {
    const atm = Math.round(spot / 50) * 50;
    return [
      { type: 'put',  side: 'long',  strike: atm - 100, premium: 50,  lots: 1, lotSize: ls },
      { type: 'put',  side: 'short', strike: atm,       premium: 120, lots: 1, lotSize: ls },
      { type: 'call', side: 'short', strike: atm,       premium: 130, lots: 1, lotSize: ls },
      { type: 'call', side: 'long',  strike: atm + 100, premium: 55,  lots: 1, lotSize: ls },
    ];
  },

  'Covered Call': (spot, ls) => {
    const atm = Math.round(spot / 50) * 50;
    return [
      { type: 'call', side: 'short', strike: atm + 100, premium: 80, lots: 1, lotSize: ls },
    ];
  },

  'Protective Put': (spot, ls) => {
    const atm = Math.round(spot / 50) * 50;
    return [
      { type: 'put', side: 'long', strike: atm - 100, premium: 70, lots: 1, lotSize: ls },
    ];
  },
};

/** Ordered list of preset names for rendering buttons */
export const PRESET_NAMES = Object.keys(STRATEGY_PRESETS);
