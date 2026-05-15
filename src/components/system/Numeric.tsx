/**
 * <Numeric> — single source of truth for all formatted-number rendering.
 * ADR-026 §2 + §5 + §6.
 *
 * Raw `value.toFixed()` / `Intl.NumberFormat` in JSX is a PR-rejection
 * pattern; route everything through this component instead.
 *
 *   <Numeric value={1234567.89} format="currency" />          → ₹12,34,567.89
 *   <Numeric value={0.0234} format="percent" colorBySign />   → +2.34% (in --up color)
 *   <Numeric value={-1500} format="pnl" colorBySign withArrow /> → ↓ −₹1,500.00
 *   <Numeric value={1.2345e9} format="currency" compact />    → ₹1.23 Cr
 */

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  directionOf,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatInteger,
} from "@/lib/format";

export type NumericFormat =
  | "currency"  // ₹1,23,456.78 — for absolute money values
  | "pnl"       // signed currency, sign forced (₹+1,500 / −₹1,500)
  | "percent"   // 12.34% — accepts fraction (0.1234) by default
  | "integer"   // 1,23,456
  | "decimal";  // 1,23,456.78

interface NumericProps {
  /** The raw value (currency amount, fraction for percent, etc.). */
  value: number | null | undefined;
  format?: NumericFormat;
  /** ISO currency code; defaults to INR. */
  currency?: string;
  /** Compact notation (lakh/crore for en-IN). */
  compact?: boolean;
  /** Apply --up / --down color based on sign. Default false (neutral). */
  colorBySign?: boolean;
  /** Prepend ↑ / ↓ glyph alongside the color (colorblind-safe per ADR-026 §5). */
  withArrow?: boolean;
  /** Force +/− prefix even on positive numbers. */
  showSign?: boolean;
  /** Override fraction digits. */
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  /** Locale; en-IN default. */
  locale?: string;
  /** For percent: is value already a fraction (0.05 = 5%)? Default true. */
  isFraction?: boolean;
  /** Text shown when value is null/undefined/NaN. */
  placeholder?: string;
  /** Accessible label override. Otherwise direction is added to text in aria-label. */
  accessibleLabel?: string;
  className?: string;
  title?: string;
  /** As prop is a defense against using <Numeric> where you'd otherwise wrap in <td>/<span>. */
  as?: "span" | "td" | "div" | "p";
}

export function Numeric({
  value,
  format = "decimal",
  currency = "INR",
  compact = false,
  colorBySign = false,
  withArrow = false,
  showSign = false,
  maximumFractionDigits,
  minimumFractionDigits,
  locale,
  isFraction = true,
  placeholder = "—",
  accessibleLabel,
  className,
  title,
  as: Tag = "span",
}: NumericProps) {
  if (value == null || !Number.isFinite(value)) {
    return (
      <Tag
        className={cn("tabular-nums text-muted-foreground", className)}
        aria-label={accessibleLabel}
      >
        {placeholder}
      </Tag>
    );
  }

  const forceSign = showSign || format === "pnl";
  const text = formatValue(value, format, {
    currency,
    compact,
    showSign: forceSign,
    maximumFractionDigits,
    minimumFractionDigits,
    locale,
    isFraction,
  });

  const direction = colorBySign ? directionOf(value) : "flat";
  const colorClass =
    direction === "up"
      ? "text-up"
      : direction === "down"
      ? "text-down"
      : undefined;

  // Resolved aria-label for screen readers — supplements color + arrow.
  const ariaLabel =
    accessibleLabel ??
    (colorBySign && direction !== "flat"
      ? `${direction === "up" ? "up" : "down"} ${text}`
      : undefined);

  return (
    <Tag
      className={cn("tabular-nums", colorClass, className)}
      aria-label={ariaLabel}
      title={title}
    >
      {withArrow && direction === "up" && (
        <ArrowUp
          className="inline h-3 w-3 align-[-1px] mr-0.5"
          aria-hidden="true"
        />
      )}
      {withArrow && direction === "down" && (
        <ArrowDown
          className="inline h-3 w-3 align-[-1px] mr-0.5"
          aria-hidden="true"
        />
      )}
      {withArrow && direction === "flat" && colorBySign && (
        <Minus
          className="inline h-3 w-3 align-[-1px] mr-0.5 text-muted-foreground"
          aria-hidden="true"
        />
      )}
      {text}
    </Tag>
  );
}

function formatValue(
  value: number,
  format: NumericFormat,
  opts: {
    currency: string;
    compact: boolean;
    showSign: boolean;
    maximumFractionDigits?: number;
    minimumFractionDigits?: number;
    locale?: string;
    isFraction: boolean;
  },
): string {
  switch (format) {
    case "currency":
    case "pnl":
      return formatCurrency(value, {
        currency: opts.currency,
        compact: opts.compact,
        showSign: opts.showSign,
        maximumFractionDigits: opts.maximumFractionDigits,
        minimumFractionDigits: opts.minimumFractionDigits,
        locale: opts.locale,
      });
    case "percent":
      return formatPercent(value, {
        isFraction: opts.isFraction,
        showSign: opts.showSign,
        maximumFractionDigits: opts.maximumFractionDigits,
        minimumFractionDigits: opts.minimumFractionDigits,
        locale: opts.locale,
      });
    case "integer":
      return formatInteger(value, opts.locale);
    case "decimal":
    default:
      return formatNumber(value, {
        compact: opts.compact,
        showSign: opts.showSign,
        maximumFractionDigits: opts.maximumFractionDigits,
        minimumFractionDigits: opts.minimumFractionDigits,
        locale: opts.locale,
      });
  }
}
