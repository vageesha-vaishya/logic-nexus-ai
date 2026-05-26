// Retail glossary — seed dictionary for the <Term> + <WhyButton> layer.
// Keys are lowercase; lookups are case-insensitive. Body ≤2 short sentences,
// plain language, no jargon-defining-jargon. Grow this over time.

export type GlossaryEntry = { title: string; body: string };

export const GLOSSARY: Readonly<Record<string, GlossaryEntry>> = Object.freeze({
  "p/e ratio": {
    title: "P/E Ratio",
    body: "Price-to-earnings. How many years of current profit you'd pay for one share. Lower is cheaper; over 30 is expensive for most sectors.",
  },
  pe: {
    title: "P/E Ratio",
    body: "Price-to-earnings. How many years of current profit you'd pay for one share. Lower is cheaper; over 30 is expensive for most sectors.",
  },
  beta: {
    title: "Beta",
    body: "How much the stock moves vs the market. 1.0 = same. 1.5 = 50% more swing. Under 1.0 = steadier.",
  },
  drawdown: {
    title: "Drawdown",
    body: "The drop from a recent peak. A 15% drawdown means the value fell 15% from its highest point in the window.",
  },
  intraday: {
    title: "Intraday",
    body: "Trade opened and closed the same trading day. No overnight risk, but you need to be active during market hours.",
  },
  swing: {
    title: "Swing Trade",
    body: "Held a few days to a few weeks. Aims for short price moves, not long-term growth.",
  },
  positional: {
    title: "Positional Trade",
    body: "Held a few weeks to a few months. Longer than swing, shorter than long-term investing.",
  },
  "long-term": {
    title: "Long-Term",
    body: "Held over a year. In India, gains over a year qualify for lower LTCG tax.",
  },
  equity: {
    title: "Equity",
    body: "Shares of a company. Owning equity means owning a piece of that business.",
  },
  mf: {
    title: "Mutual Fund",
    body: "A pooled fund managed by professionals. You buy units; the fund manager picks the underlying stocks/bonds.",
  },
  sip: {
    title: "SIP",
    body: "Systematic Investment Plan. A fixed amount auto-invested every month, usually into a mutual fund.",
  },
  "f&o": {
    title: "F&O",
    body: "Futures and Options. Contracts that bet on price moves without owning the stock. Higher reward but can lose more than you put in.",
  },
  "stop-loss": {
    title: "Stop-Loss",
    body: "A pre-set price that triggers an auto-sell to cap your loss. Set it when you buy so emotions don't override it later.",
  },
  target: {
    title: "Target Price",
    body: "The price at which you plan to book profit. Helps lock gains instead of holding out for more and watching it slip.",
  },
  // (ltcg moved further down — kept the more detailed entry that mentions the
  // ₹1,25,000 tax-free pool and the FY-reset behaviour.)
  stcg: {
    title: "STCG (Short-Term Capital Gains)",
    body: "Profit on equity held 1 year or less. Taxed at 20% in India — much higher than LTCG.",
  },
  nav: {
    title: "NAV (Net Asset Value)",
    body: "Price of one mutual fund unit. Updated once a day after market close, not minute-by-minute like a stock.",
  },
  aum: {
    title: "AUM (Assets Under Management)",
    body: "Total money the fund is managing. Bigger AUM usually means more stability and lower expense ratio.",
  },
  "expense ratio": {
    title: "Expense Ratio",
    body: "Annual fee a mutual fund charges, as a % of your investment. Under 1% is good for an active fund; under 0.5% for an index fund.",
  },
  volatility: {
    title: "Volatility",
    body: "How much the price swings. Higher volatility = bigger up and down moves, more stress, but sometimes more opportunity.",
  },
  support: {
    title: "Support",
    body: "A price level where buyers have historically stepped in. If the price approaches it, it often bounces — until one day it doesn't.",
  },
  resistance: {
    title: "Resistance",
    body: "A price level where sellers historically take profits. Breaking above it usually signals a stronger up-move.",
  },
  rsi: {
    title: "RSI",
    body: "Relative Strength Index. Reads 0–100. Above 70 = overbought (may pull back); below 30 = oversold (may bounce).",
  },
  "moving average": {
    title: "Moving Average",
    body: "The average closing price over a recent window (like 50 or 200 days). Smooths out noise to show the underlying trend.",
  },
  vwap: {
    title: "VWAP",
    body: "Volume-Weighted Average Price. The average intraday price weighted by how much traded at each level. Used to judge intraday entry quality.",
  },
  "risk profile": {
    title: "Risk Profile",
    body: "How much loss you can take without panicking. Drives tier allocation: conservative = more Safety Net; aggressive = more Experimental.",
  },
  "asset class": {
    title: "Asset Class",
    body: "A category of investment with similar behaviour: equity, mutual funds, F&O, forex, bonds, commodities.",
  },
  "portfolio tier": {
    title: "Portfolio Tier",
    body: "A bucket of holdings grouped by risk. Three tiers: Safety Net (capital protection), Core (long-term growth), Experimental (high-risk swings).",
  },
  confidence: {
    title: "Signal Confidence",
    body: "How many indicators agree on a signal. Strong = many agree; Moderate = mixed; Watch = early/weak setup.",
  },
  horizon: {
    title: "Horizon",
    body: "How long you plan to hold the trade. Intraday < Swing < Positional < Long-term.",
  },
  "r/r": {
    title: "R/R (Risk-Reward)",
    body: "Ratio of expected profit to expected loss. 2:1 means you target ₹2 of profit for every ₹1 you risk. Aim for ≥1.5:1.",
  },
  leverage: {
    title: "Leverage",
    body: "Borrowed money to take a bigger position than your capital allows. Multiplies both gains and losses — handle with care.",
  },
  rebalancing: {
    title: "Rebalancing",
    body: "Selling some of what's grown and buying more of what's shrunk to bring your tier weights back to plan. Forces disciplined buy-low/sell-high.",
  },
  "drawdown alert": {
    title: "Drawdown Alert",
    body: "A banner that warns when your portfolio falls a set % from its peak. Helps you pause before panic-selling.",
  },
  ltcg: {
    title: "LTCG (Long-Term Capital Gains)",
    body: "Profit from selling equity you held longer than 12 months. The first ₹1,25,000 of LTCG every financial year is tax-free; anything above is taxed at 12.5%.",
  },
  "ltcg exemption": {
    title: "LTCG Exemption",
    body: "The ₹1,25,000 per-year tax-free pool on long-term equity gains. It resets every Indian financial year (April 1). Use it before March 31 or lose it.",
  },
});

/** Case-insensitive lookup. Returns undefined if the key isn't seeded. */
export function lookupTerm(word: string): GlossaryEntry | undefined {
  return GLOSSARY[word.trim().toLowerCase()];
}
