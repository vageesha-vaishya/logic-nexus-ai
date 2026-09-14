import { HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export type RiskLevel = "low" | "medium" | "high";

const TONE: Record<RiskLevel, string> = {
  low: "bg-status-success text-status-success-foreground border-status-success-border",
  medium:
    "bg-status-warning text-status-warning-foreground border-status-warning-border",
  high: "bg-status-danger text-status-danger-foreground border-status-danger-border",
};

const DOT_TONE: Record<RiskLevel, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-red-500",
};

const DEFAULT_LABEL: Record<RiskLevel, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

export interface RiskPillProps {
  risk: RiskLevel;
  label?: string;
  /**
   * Internal route to the methodology page that explains how this risk
   * level is computed. When present, a small help icon links there.
   * Defaults to `/methodology/volatility` — override only if a different
   * methodology page applies (e.g., a custom basket benchmark).
   */
  methodologyHref?: string;
  /**
   * When false, the methodology link is hidden entirely. Default true so
   * regulator-facing surfaces always expose the math.
   */
  showMethodologyLink?: boolean;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Groww + Smallcase pattern: a single risk pill (Low / Medium / High) that
 * a layman can read at a glance, paired with a one-tap link to the
 * methodology page. The methodology link is the SEBI-defensible artifact —
 * never hide it.
 */
export function RiskPill({
  risk,
  label,
  methodologyHref = "/methodology/volatility",
  showMethodologyLink = true,
  className,
  size = "md",
}: RiskPillProps): JSX.Element {
  const sizing =
    size === "sm" ? "h-5 px-1.5 text-[10px] gap-1" : "h-6 px-2 text-xs gap-1.5";
  const text = label ?? DEFAULT_LABEL[risk];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium select-none",
        sizing,
        TONE[risk],
        className,
      )}
      data-risk={risk}
      role="img"
      aria-label={text}
    >
      <span className={cn("rounded-full", DOT_TONE[risk], size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2")} aria-hidden="true" />
      <span>{text}</span>
      {showMethodologyLink && (
        <Link
          to={methodologyHref}
          aria-label="How is this risk calculated?"
          className="inline-flex items-center rounded-full hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          onClick={(e) => e.stopPropagation()}
        >
          <HelpCircle className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
        </Link>
      )}
    </span>
  );
}
