/** Returns true if NSE is currently open (Mon–Fri, 9:15–15:30 IST). */
export function isMarketOpen(): boolean {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const day = ist.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return mins >= 555 && mins < 930;
}

/** Returns "NSE Live" or "NSE Closed · Opens Mon 9:15 AM IST" */
export function marketStatusLabel(): string {
  if (isMarketOpen()) return "NSE Live";
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const day = ist.getUTCDay();
  if (day === 0) return "NSE Closed · Opens Mon 9:15 AM IST";
  if (day === 6) return "NSE Closed · Opens Mon 9:15 AM IST";
  return "NSE Closed · Opens 9:15 AM IST";
}
