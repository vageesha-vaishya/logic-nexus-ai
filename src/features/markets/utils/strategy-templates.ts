/**
 * Pre-built option strategy templates.
 * Each factory takes market params and returns legs without IDs/expiry
 * (those are added by the builder when instantiating).
 */

import type { StrategyLeg } from "./options-payoff";

export interface StrategyTemplate {
  name: string;
  description: string;
  category: "bullish" | "bearish" | "neutral" | "volatile";
  legs: (params: TemplateParams) => Omit<StrategyLeg, "id" | "expiry">[];
}

export interface TemplateParams {
  spot: number;
  atm: number;          // ATM strike (nearest round number)
  otm1: number;         // 1 step OTM CE strike
  otm2: number;         // 2 steps OTM CE strike
  itm1: number;         // 1 step ITM CE strike (= 1 step OTM PE)
  atmCePremium: number;
  atmPePremium: number;
  otm1CePremium: number;
  otm1PePremium: number;
  lotSize: number;
}

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    name: "Long Straddle",
    description: "Buy ATM CE + ATM PE. Profit from big moves in either direction.",
    category: "volatile",
    legs: (p) => [
      { optionType: "CE", direction: "buy", strike: p.atm, premium: p.atmCePremium, qty: 1, lotSize: p.lotSize },
      { optionType: "PE", direction: "buy", strike: p.atm, premium: p.atmPePremium, qty: 1, lotSize: p.lotSize },
    ],
  },
  {
    name: "Short Straddle",
    description: "Sell ATM CE + ATM PE. Profit when market stays range-bound.",
    category: "neutral",
    legs: (p) => [
      { optionType: "CE", direction: "sell", strike: p.atm, premium: p.atmCePremium, qty: 1, lotSize: p.lotSize },
      { optionType: "PE", direction: "sell", strike: p.atm, premium: p.atmPePremium, qty: 1, lotSize: p.lotSize },
    ],
  },
  {
    name: "Bull Call Spread",
    description: "Buy lower CE + Sell higher CE. Defined risk bullish play.",
    category: "bullish",
    legs: (p) => [
      { optionType: "CE", direction: "buy", strike: p.atm, premium: p.atmCePremium, qty: 1, lotSize: p.lotSize },
      { optionType: "CE", direction: "sell", strike: p.otm1, premium: p.otm1CePremium, qty: 1, lotSize: p.lotSize },
    ],
  },
  {
    name: "Bear Put Spread",
    description: "Buy higher PE + Sell lower PE. Defined risk bearish play.",
    category: "bearish",
    legs: (p) => [
      { optionType: "PE", direction: "buy", strike: p.atm, premium: p.atmPePremium, qty: 1, lotSize: p.lotSize },
      { optionType: "PE", direction: "sell", strike: p.otm1, premium: p.otm1PePremium, qty: 1, lotSize: p.lotSize },
    ],
  },
  {
    name: "Iron Condor",
    description: "Sell OTM CE + Buy further OTM CE + Sell OTM PE + Buy further OTM PE. Max profit in range.",
    category: "neutral",
    legs: (p) => [
      { optionType: "CE", direction: "sell", strike: p.otm1, premium: p.otm1CePremium, qty: 1, lotSize: p.lotSize },
      { optionType: "CE", direction: "buy", strike: p.otm2, premium: p.otm1CePremium * 0.4, qty: 1, lotSize: p.lotSize },
      { optionType: "PE", direction: "sell", strike: p.itm1, premium: p.otm1PePremium, qty: 1, lotSize: p.lotSize },
      { optionType: "PE", direction: "buy", strike: p.atm - (p.otm1 - p.atm) * 2, premium: p.otm1PePremium * 0.4, qty: 1, lotSize: p.lotSize },
    ],
  },
  {
    name: "Long Strangle",
    description: "Buy OTM CE + OTM PE. Cheaper than straddle, needs bigger move.",
    category: "volatile",
    legs: (p) => [
      { optionType: "CE", direction: "buy", strike: p.otm1, premium: p.otm1CePremium, qty: 1, lotSize: p.lotSize },
      { optionType: "PE", direction: "buy", strike: p.itm1, premium: p.otm1PePremium, qty: 1, lotSize: p.lotSize },
    ],
  },
];
