/**
 * Pure-functional helpers for the Withdraw screen (Phase 1 Addendum T16).
 *
 * Each helper computes one piece of the projection — settlement timeline,
 * MF exit load, and STCG/LTCG impact. Kept TS-only (no DB / network) so
 * the unit tests run instantly and the UI can preview values as the user
 * types without round-trips.
 *
 * NOT a tax-advice surface. All numbers are clearly labelled "estimate"
 * in the UI; the exact figure depends on per-trade FIFO, exemption use
 * earlier in the FY, and any sectoral nuances we don't model.
 */

export type AssetClass = "equity" | "mf_equity" | "mf_debt" | "fo" | "bond" | "commodity";

// India equity + F&O settled T+1 since Jan 2023. MF settlement varies by
// scheme; we use the SEBI guideline ceilings as conservative defaults.
const SETTLEMENT_BUSINESS_DAYS: Record<AssetClass, number> = {
  equity:     1,
  fo:         1,
  mf_equity:  3,
  mf_debt:    2,
  bond:       1,
  commodity:  1,
};

/** Friendly labels for the settlement card. */
export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  equity:    "Equity (NSE/BSE)",
  fo:        "F&O",
  mf_equity: "Equity mutual fund",
  mf_debt:   "Debt mutual fund",
  bond:      "Bonds",
  commodity: "Commodity",
};

/**
 * Add N business days to a date, skipping Saturday + Sunday.
 * Holidays are NOT modelled — the result is an upper bound on speed; the
 * UI shows "by Mon, Mar 4" rather than "exactly Mon, Mar 4" to absorb
 * the holiday slack.
 */
function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay(); // 0 = Sun, 6 = Sat
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

export interface SettlementProjection {
  /** Human label e.g. "T+1 (Equity)" */
  label:    string;
  /** ISO date string (YYYY-MM-DD) — UI formats for locale */
  dateISO:  string;
  /** Number of business days from `today` */
  businessDaysOut: number;
}

export function computeSettlementDate(
  today: Date,
  assetClass: AssetClass,
): SettlementProjection {
  const businessDaysOut = SETTLEMENT_BUSINESS_DAYS[assetClass] ?? 1;
  const settle = addBusinessDays(today, businessDaysOut);
  const iso = settle.toISOString().slice(0, 10);
  return {
    label: `T+${businessDaysOut} (${ASSET_CLASS_LABEL[assetClass]})`,
    dateISO: iso,
    businessDaysOut,
  };
}

// ── Exit loads ────────────────────────────────────────────────────────────────
//
// Equity / F&O / bonds typically have zero exit load. Mutual funds usually
// apply 1% (equity) or 0.25% (debt) if redeemed within a defined window
// (12 months equity, 30 days debt by default). Real exit loads are scheme-
// specific — we expose `customLoadPct` so the UI can override per fund.

export interface ExitLoadProjection {
  /** ₹ amount of exit load. 0 when not applicable. */
  amount:  number;
  /** "no exit load" | "0.25% applied (within 30 days)" | … */
  reason:  string;
}

const MF_EQUITY_EXIT_LOAD_PCT = 1.0;
const MF_EQUITY_EXIT_WINDOW_MONTHS = 12;

const MF_DEBT_EXIT_LOAD_PCT = 0.25;
const MF_DEBT_EXIT_WINDOW_DAYS = 30;

export function computeExitLoad(
  amount: number,
  monthsHeld: number,
  assetClass: AssetClass,
  customLoadPct?: number,
): ExitLoadProjection {
  if (amount <= 0) return { amount: 0, reason: "no amount to withdraw" };

  if (customLoadPct !== undefined && customLoadPct > 0) {
    return {
      amount: Math.round((amount * customLoadPct) / 100),
      reason: `${customLoadPct.toFixed(2)}% custom load`,
    };
  }

  if (assetClass === "mf_equity") {
    if (monthsHeld >= MF_EQUITY_EXIT_WINDOW_MONTHS) {
      return { amount: 0, reason: `no load after ${MF_EQUITY_EXIT_WINDOW_MONTHS} months` };
    }
    return {
      amount: Math.round((amount * MF_EQUITY_EXIT_LOAD_PCT) / 100),
      reason: `${MF_EQUITY_EXIT_LOAD_PCT}% (within ${MF_EQUITY_EXIT_WINDOW_MONTHS} months)`,
    };
  }

  if (assetClass === "mf_debt") {
    const daysHeld = monthsHeld * 30;
    if (daysHeld >= MF_DEBT_EXIT_WINDOW_DAYS) {
      return { amount: 0, reason: `no load after ${MF_DEBT_EXIT_WINDOW_DAYS} days` };
    }
    return {
      amount: Math.round((amount * MF_DEBT_EXIT_LOAD_PCT) / 100),
      reason: `${MF_DEBT_EXIT_LOAD_PCT}% (within ${MF_DEBT_EXIT_WINDOW_DAYS} days)`,
    };
  }

  return { amount: 0, reason: "no exit load on this asset class" };
}

// ── Tax impact (indicative) ──────────────────────────────────────────────────
//
// India equity / equity-MF tax rules (FY 2025-26, post-Jul-2024 Budget):
//
//   Holding period > 12 months → LTCG @ 12.5%, first ₹1.25L per FY exempt
//   Holding period ≤ 12 months → STCG @ 20%
//
// Debt MFs: post-Apr-2023 holdings are slab-taxed regardless of period;
// pre-Apr-2023 holdings retain LTCG rates. We model the post-2023 case
// only — anyone with grandfathered units should treat the projection as
// a ceiling. The UI flags this assumption.
//
// We need a *gain* number, not the redemption amount, to compute tax —
// the UI asks the user to enter approximate gain because we can't reliably
// derive it from broker-aggregated holdings.

const LTCG_RATE_EQUITY     = 0.125;
const LTCG_EXEMPT_PER_FY   = 125_000;     // ₹1.25L
const STCG_RATE_EQUITY     = 0.20;
const SLAB_RATE_DEBT_GUESS = 0.30;        // top slab — UI labels it "up to 30%"

export interface TaxImpactProjection {
  /** ₹ tax — short-term portion. */
  stcg:           number;
  /** ₹ tax — long-term portion. */
  ltcg:           number;
  /** ₹ exemption consumed by this withdrawal. */
  exemptionUsed:  number;
  /** ₹ exemption remaining for the rest of the FY. */
  exemptionLeft:  number;
  /** Human breakdown line e.g. "₹1L gain → ₹0 LTCG (within exemption)". */
  breakdown:      string;
  /** Total tax = stcg + ltcg. */
  total:          number;
}

export function computeTaxImpact(
  gainAmount: number,
  holdingYears: number,
  ltcgRoomLeftThisFY: number,
  assetClass: AssetClass,
): TaxImpactProjection {
  if (gainAmount <= 0) {
    return {
      stcg: 0, ltcg: 0,
      exemptionUsed: 0, exemptionLeft: Math.min(ltcgRoomLeftThisFY, LTCG_EXEMPT_PER_FY),
      breakdown: "No gain → no tax estimated.",
      total: 0,
    };
  }

  const exemptionLeft = Math.max(0, Math.min(ltcgRoomLeftThisFY, LTCG_EXEMPT_PER_FY));

  // Debt MFs (post-Apr-2023 cohort) → slab-rate regardless of period.
  if (assetClass === "mf_debt") {
    const tax = Math.round(gainAmount * SLAB_RATE_DEBT_GUESS);
    return {
      stcg: tax, ltcg: 0,
      exemptionUsed: 0, exemptionLeft,
      breakdown: `Debt MF gain ₹${gainAmount.toLocaleString("en-IN")} → ~${(SLAB_RATE_DEBT_GUESS * 100).toFixed(0)}% slab tax. Actual rate depends on your income bracket.`,
      total: tax,
    };
  }

  // Equity / equity-MF / F&O / bond / commodity → STCG vs LTCG by period.
  // (F&O is technically business income, not capital gains — flagged in UI.)
  if (holdingYears < 1) {
    const stcg = Math.round(gainAmount * STCG_RATE_EQUITY);
    return {
      stcg, ltcg: 0,
      exemptionUsed: 0, exemptionLeft,
      breakdown: `Gain ₹${gainAmount.toLocaleString("en-IN")} held <1 yr → STCG @ 20% = ₹${stcg.toLocaleString("en-IN")}.`,
      total: stcg,
    };
  }

  // Long-term: applies exemption first.
  const exemptionUsed = Math.min(gainAmount, exemptionLeft);
  const taxable       = Math.max(0, gainAmount - exemptionUsed);
  const ltcg          = Math.round(taxable * LTCG_RATE_EQUITY);
  const breakdown = exemptionUsed > 0
    ? `Gain ₹${gainAmount.toLocaleString("en-IN")} held ≥1 yr → ₹${exemptionUsed.toLocaleString("en-IN")} uses LTCG exemption, ₹${taxable.toLocaleString("en-IN")} taxed @ 12.5% = ₹${ltcg.toLocaleString("en-IN")}.`
    : `Gain ₹${gainAmount.toLocaleString("en-IN")} held ≥1 yr → LTCG @ 12.5% = ₹${ltcg.toLocaleString("en-IN")} (₹1.25L exemption already used this FY).`;

  return {
    stcg: 0,
    ltcg,
    exemptionUsed,
    exemptionLeft: exemptionLeft - exemptionUsed,
    breakdown,
    total: ltcg,
  };
}
