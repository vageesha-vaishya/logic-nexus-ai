/**
 * Markets — SignalBadge component.
 *
 * Displays a compact signal direction badge (BUY / SELL / NEUTRAL)
 * with confidence % and a tooltip showing the full rationale plus
 * individual RSI / MACD / SuperTrend indicator values.
 *
 * Sizes:
 *   "sm"  — colored dot + direction text only (for dense table rows)
 *   "md"  — trending icon + "BUY 78%" text (default)
 */

import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import {
  Badge,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/design-system";

import type { SignalSummary } from "../hooks/useSignals";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignalBadgeProps {
  signal?: SignalSummary;
  size?:   "sm" | "md";
}

// ─── Direction config ─────────────────────────────────────────────────────────

const DIR_CONFIG = {
  buy: {
    label:   "BUY",
    dot:     "bg-emerald-500",
    text:    "text-emerald-700 dark:text-emerald-400",
    badge:   "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    icon:    TrendingUp,
  },
  sell: {
    dot:     "bg-rose-500",
    label:   "SELL",
    text:    "text-rose-700 dark:text-rose-400",
    badge:   "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
    icon:    TrendingDown,
  },
  neutral: {
    dot:     "bg-slate-400",
    label:   "NEUTRAL",
    text:    "text-muted-foreground",
    badge:   "bg-muted text-muted-foreground",
    icon:    Minus,
  },
} as const;

// ─── Indicator row (for tooltip) ──────────────────────────────────────────────

function IndicatorLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}

function IndicatorsPanel({ indicators }: { indicators: SignalSummary["indicators"] }) {
  const { rsi, macd, supertrend } = indicators;
  return (
    <div className="mt-2 space-y-1 text-xs">
      <p className="font-semibold text-foreground/80">Indicators</p>
      {rsi != null && (
        <IndicatorLine label="RSI (14)" value={rsi.toFixed(1)} />
      )}
      {macd != null && (
        <>
          <IndicatorLine label="MACD" value={macd.macd.toFixed(3)} />
          <IndicatorLine label="MACD Histogram" value={macd.histogram.toFixed(3)} />
          {macd.crossover !== "none" && (
            <IndicatorLine label="MACD Crossover" value={macd.crossover} />
          )}
        </>
      )}
      {supertrend != null && (
        <IndicatorLine
          label="SuperTrend"
          value={`${supertrend.direction === "up" ? "↑" : "↓"} ${supertrend.signal.toUpperCase()}`}
        />
      )}
    </div>
  );
}

// ─── Badge core ───────────────────────────────────────────────────────────────

function SmallBadge({ signal }: { signal: SignalSummary }) {
  const cfg = DIR_CONFIG[signal.direction];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.text}`}>
      <span className={`h-2 w-2 rounded-full ${cfg.dot} shrink-0`} />
      {cfg.label}
    </span>
  );
}

function MediumBadge({ signal }: { signal: SignalSummary }) {
  const cfg = DIR_CONFIG[signal.direction];
  const Icon = cfg.icon;
  return (
    <Badge
      variant="outline"
      className={`inline-flex items-center gap-1 border-0 px-2 py-0.5 text-xs font-semibold ${cfg.badge}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {cfg.label} {signal.score}%
    </Badge>
  );
}

// ─── Exported component ───────────────────────────────────────────────────────

export function SignalBadge({ signal, size = "md" }: SignalBadgeProps) {
  if (!signal) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const badge = size === "sm"
    ? <SmallBadge signal={signal} />
    : <MediumBadge signal={signal} />;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default">{badge}</span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="max-w-xs space-y-1 p-3 text-xs"
        >
          <p className="font-semibold">{signal.symbol} — {DIR_CONFIG[signal.direction].label}</p>
          <p className="text-muted-foreground leading-snug">{signal.rationale}</p>
          <IndicatorsPanel indicators={signal.indicators} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
