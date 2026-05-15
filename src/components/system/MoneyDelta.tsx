/**
 * <MoneyDelta> — thin wrapper for displaying a value change.
 * ADR-026 §2 + §5.
 *
 * Always shows sign-aware color and (by default) a directional arrow,
 * because that is the entire purpose of a delta UI.
 *
 *   <MoneyDelta value={1234.5} />               → ↑ +₹1,234.50  (in --up color)
 *   <MoneyDelta value={-89.2} format="percent" /> → ↓ −89.20%
 *   <MoneyDelta value={0} />                    → — ₹0.00       (neutral)
 *   <MoneyDelta value={1234.5} secondary={2.34} secondaryFormat="percent" />
 *      → ↑ +₹1,234.50 (+2.34%)
 */

import { cn } from "@/lib/utils";
import { Numeric, type NumericFormat } from "./Numeric";

interface MoneyDeltaProps {
  value: number | null | undefined;
  /** Primary display format. "pnl" → currency with forced sign. Default "pnl". */
  format?: Extract<NumericFormat, "pnl" | "currency" | "percent" | "decimal">;
  currency?: string;
  compact?: boolean;
  /** Secondary value shown in parens (e.g., absolute change + percent change together). */
  secondary?: number | null;
  secondaryFormat?: Extract<NumericFormat, "pnl" | "currency" | "percent" | "decimal">;
  secondaryIsFraction?: boolean;
  className?: string;
  title?: string;
  /** Hide the arrow icon. Color + sign still convey direction. */
  hideArrow?: boolean;
}

export function MoneyDelta({
  value,
  format = "pnl",
  currency = "INR",
  compact = false,
  secondary,
  secondaryFormat = "percent",
  secondaryIsFraction = true,
  className,
  title,
  hideArrow = false,
}: MoneyDeltaProps) {
  return (
    <span className={cn("inline-flex items-baseline gap-1 tabular-nums", className)} title={title}>
      <Numeric
        value={value}
        format={format}
        currency={currency}
        compact={compact}
        colorBySign
        withArrow={!hideArrow}
        showSign
      />
      {secondary != null && Number.isFinite(secondary) && (
        <Numeric
          value={secondary}
          format={secondaryFormat}
          isFraction={secondaryIsFraction}
          colorBySign
          showSign
          className="text-xs opacity-80"
        />
      )}
    </span>
  );
}
