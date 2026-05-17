/**
 * XIRR — Extended Internal Rate of Return
 *
 * Computes the annualised return for a series of cash flows at irregular dates
 * using Newton-Raphson iteration.
 *
 * Convention:
 *   - Negative amount = cash paid out (SIP instalment / investment)
 *   - Positive amount = cash received (redemption value / current portfolio value)
 */

export interface CashFlow {
  amount: number;
  date: Date;
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

function npv(cashflows: CashFlow[], rate: number, t0: number): number {
  return cashflows.reduce((sum, cf) => {
    const t = (cf.date.getTime() - t0) / MS_PER_YEAR;
    return sum + cf.amount / Math.pow(1 + rate, t);
  }, 0);
}

function npvDerivative(cashflows: CashFlow[], rate: number, t0: number): number {
  return cashflows.reduce((sum, cf) => {
    const t = (cf.date.getTime() - t0) / MS_PER_YEAR;
    return sum - (t * cf.amount) / Math.pow(1 + rate, t + 1);
  }, 0);
}

/**
 * Compute XIRR for a series of cash flows at specific dates.
 *
 * @param cashflows  Array of { amount, date } — negative for payments, positive for receipts
 * @returns Annualised rate (e.g. 0.12 = 12%) or null if the series doesn't converge
 */
export function xirr(cashflows: CashFlow[]): number | null {
  if (cashflows.length < 2) return null;

  const t0 = cashflows[0].date.getTime();

  let rate = 0.1; // initial guess: 10%

  for (let i = 0; i < 100; i++) {
    const f  = npv(cashflows, rate, t0);
    const df = npvDerivative(cashflows, rate, t0);

    if (Math.abs(df) < 1e-12) return null; // flat derivative — bail

    const newRate = rate - f / df;

    if (Math.abs(newRate - rate) < 1e-7) return newRate; // converged

    rate = newRate;

    if (rate < -0.999) return null; // diverged below -100%
  }

  return null; // didn't converge in 100 iterations
}

/**
 * Format an XIRR rate as a percentage string.
 * Returns "—" for null / non-finite values.
 */
export function formatXirr(rate: number | null): string {
  if (rate === null || !isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(2)}%`;
}
