/**
 * Options payoff math utilities — pure functions, no side effects.
 * Used by the Strategy Builder to compute P&L curves and metrics.
 */

export type OptionType = "CE" | "PE";
export type TradeDirection = "buy" | "sell";

export interface StrategyLeg {
  id: string;
  optionType: OptionType;
  direction: TradeDirection;
  strike: number;
  premium: number; // per unit
  qty: number;     // number of lots
  lotSize: number; // units per lot
  expiry: string;  // ISO date
}

export interface PayoffPoint {
  spot: number;
  pnl: number;
}

export interface StrategyMetrics {
  maxProfit: number | null;   // null = unlimited
  maxLoss: number | null;     // null = unlimited
  breakevens: number[];
  netPremiumPaid: number;     // positive = paid, negative = received
  currentPnL: number;         // P&L at current spot price
}

/** Compute per-unit payoff of a single leg at given spot price at expiry */
function legPayoffPerUnit(leg: StrategyLeg, spot: number): number {
  const intrinsic = leg.optionType === "CE"
    ? Math.max(spot - leg.strike, 0)
    : Math.max(leg.strike - spot, 0);
  const netPerUnit = leg.direction === "buy"
    ? intrinsic - leg.premium
    : leg.premium - intrinsic;
  return netPerUnit;
}

/** Compute total P&L for all legs at a given spot price */
export function totalPayoff(legs: StrategyLeg[], spot: number): number {
  return legs.reduce((sum, leg) => {
    return sum + legPayoffPerUnit(leg, spot) * leg.qty * leg.lotSize;
  }, 0);
}

/** Generate payoff curve from spot-40% to spot+40% in 200 steps */
export function generatePayoffCurve(legs: StrategyLeg[], currentSpot: number): PayoffPoint[] {
  if (legs.length === 0) return [];
  const min = currentSpot * 0.6;
  const max = currentSpot * 1.4;
  const steps = 200;
  const step = (max - min) / steps;
  const points: PayoffPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const spot = min + i * step;
    points.push({ spot: Math.round(spot), pnl: Math.round(totalPayoff(legs, spot)) });
  }
  return points;
}

/** Find breakeven points where P&L crosses zero */
export function findBreakevens(curve: PayoffPoint[]): number[] {
  const breakevens: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    if (
      (curve[i - 1].pnl < 0 && curve[i].pnl >= 0) ||
      (curve[i - 1].pnl > 0 && curve[i].pnl <= 0)
    ) {
      const denom = curve[i].pnl - curve[i - 1].pnl;
      if (denom === 0) continue;
      const x =
        curve[i - 1].spot +
        ((0 - curve[i - 1].pnl) * (curve[i].spot - curve[i - 1].spot)) / denom;
      breakevens.push(Math.round(x));
    }
  }
  return breakevens;
}

/** Compute strategy metrics from payoff curve */
export function computeMetrics(
  legs: StrategyLeg[],
  curve: PayoffPoint[],
  currentSpot: number,
): StrategyMetrics {
  if (curve.length === 0) {
    return {
      maxProfit: 0,
      maxLoss: 0,
      breakevens: [],
      netPremiumPaid: 0,
      currentPnL: 0,
    };
  }

  const pnlValues = curve.map(p => p.pnl);
  const maxPnl = Math.max(...pnlValues);
  const minPnl = Math.min(...pnlValues);

  // Check if profit/loss is "unlimited" (continues increasing at boundary)
  const isUnlimitedProfit =
    curve[curve.length - 1].pnl > curve[curve.length - 3].pnl &&
    maxPnl === curve[curve.length - 1].pnl;
  const isUnlimitedLoss =
    curve[0].pnl < curve[2].pnl && minPnl === curve[0].pnl;

  const netPremium = legs.reduce((sum, leg) => {
    const cost = leg.premium * leg.qty * leg.lotSize;
    return sum + (leg.direction === "buy" ? cost : -cost);
  }, 0);

  return {
    maxProfit: isUnlimitedProfit ? null : maxPnl,
    maxLoss: isUnlimitedLoss ? null : minPnl,
    breakevens: findBreakevens(curve),
    netPremiumPaid: netPremium,
    currentPnL: Math.round(totalPayoff(legs, currentSpot)),
  };
}
