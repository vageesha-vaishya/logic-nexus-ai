/**
 * Number / currency / date formatting utilities — ADR-026 §6.
 *
 * Use these via the <Numeric> primitive in components, NOT directly in JSX.
 * (Raw `value.toFixed()` or `Intl.NumberFormat` in component bodies is a
 * PR-rejection pattern.)
 */

const EN_IN = "en-IN";

// ─── Currency / decimal / percent / integer ──────────────────────────────────

interface FormatCurrencyOptions {
  currency?: string;            // ISO code; defaults to INR
  locale?: string;              // BCP-47; defaults to en-IN
  compact?: boolean;            // true → ₹12.34 L / ₹1.23 Cr
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  showSign?: boolean;           // forces +/− prefix; default false
}

/**
 * Format a number as INR (default) with Indian lakh/crore grouping when locale=en-IN.
 *   formatCurrency(123456.78) → "₹1,23,456.78"
 *   formatCurrency(12345678, { compact: true }) → "₹1.23 Cr" (Indian compact notation)
 *   formatCurrency(-1500, { showSign: true }) → "−₹1,500.00"
 */
export function formatCurrency(value: number, opts: FormatCurrencyOptions = {}): string {
  if (!Number.isFinite(value)) return "—";

  const {
    currency = "INR",
    locale = EN_IN,
    compact = false,
    maximumFractionDigits = compact ? 2 : 2,
    minimumFractionDigits = compact ? 0 : 2,
    showSign = false,
  } = opts;

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      compactDisplay: "short",
      maximumFractionDigits,
      minimumFractionDigits,
      signDisplay: showSign ? "exceptZero" : "auto",
    });
    return formatter.format(value);
  } catch {
    // Fallback if locale unavailable
    return `${currency} ${value.toFixed(2)}`;
  }
}

interface FormatNumberOptions {
  locale?: string;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  showSign?: boolean;
  compact?: boolean;
}

export function formatNumber(value: number, opts: FormatNumberOptions = {}): string {
  if (!Number.isFinite(value)) return "—";
  const {
    locale = EN_IN,
    maximumFractionDigits = 2,
    minimumFractionDigits = 0,
    showSign = false,
    compact = false,
  } = opts;
  return new Intl.NumberFormat(locale, {
    notation: compact ? "compact" : "standard",
    compactDisplay: "short",
    maximumFractionDigits,
    minimumFractionDigits,
    signDisplay: showSign ? "exceptZero" : "auto",
  }).format(value);
}

interface FormatPercentOptions {
  /** If true, the input is already a fraction (0.05 → "5%"); else it's a percent (5 → "5%"). Default true. */
  isFraction?: boolean;
  locale?: string;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  showSign?: boolean;
}

export function formatPercent(value: number, opts: FormatPercentOptions = {}): string {
  if (!Number.isFinite(value)) return "—";
  const {
    isFraction = true,
    locale = EN_IN,
    maximumFractionDigits = 2,
    minimumFractionDigits = 0,
    showSign = false,
  } = opts;
  const fraction = isFraction ? value : value / 100;
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits,
    minimumFractionDigits,
    signDisplay: showSign ? "exceptZero" : "auto",
  }).format(fraction);
}

export function formatInteger(value: number, locale: string = EN_IN): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

// ─── Sign / direction helpers ────────────────────────────────────────────────

export type Direction = "up" | "down" | "flat";

/** Map a number to a direction. NaN/0 → "flat"; mind: 0.00001 → "up". */
export function directionOf(value: number, epsilon: number = 0): Direction {
  if (!Number.isFinite(value)) return "flat";
  if (value > epsilon) return "up";
  if (value < -epsilon) return "down";
  return "flat";
}

// ─── Dates ────────────────────────────────────────────────────────────────────

/** Short, India-friendly date: "15 May 2026" */
export function formatDate(
  value: string | Date,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
  locale: string = EN_IN,
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, opts).format(date);
}

/** "15 May 2026 · 14:32" */
export function formatDateTime(
  value: string | Date,
  locale: string = EN_IN,
): string {
  return formatDate(
    value,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
    locale,
  );
}

/** "5 min ago", "2 h ago", "3 d ago". For long deltas, falls back to formatDate. */
export function formatRelativeTime(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const diffSec = Math.round((date.getTime() - now.getTime()) / 1000);
  const absSec = Math.abs(diffSec);

  let rtf: Intl.RelativeTimeFormat;
  try {
    rtf = new Intl.RelativeTimeFormat(EN_IN, { numeric: "auto", style: "short" });
  } catch {
    return formatDate(date);
  }

  if (absSec < 60) return rtf.format(diffSec, "second");
  if (absSec < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (absSec < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (absSec < 7 * 86400) return rtf.format(Math.round(diffSec / 86400), "day");
  return formatDate(date);
}
