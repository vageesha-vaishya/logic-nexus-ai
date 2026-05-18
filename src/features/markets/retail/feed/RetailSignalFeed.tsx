import { useMemo, useState } from 'react';

import { InlineEducation } from '../behavioral/InlineEducation';
import type { AlertTier } from '../behavioral/types';
import { useInlineEducation } from '../behavioral/useInlineEducation';
import { ExecutionBottomSheet } from './ExecutionBottomSheet';
import { SignalCard } from './SignalCard';
import { SignalFilter, type SignalFilterState } from './SignalFilter';
import { useRetailSignals } from '../hooks/useRetailSignals';
import type { ExperienceLevel, RetailSignal } from '../types';

const HIGH_CONVICTION_THRESHOLD = 0.85;

interface RetailSignalFeedProps {
  experienceLevel: ExperienceLevel;
  /**
   * Override the default execution flow. When omitted, clicking Buy/Sell on a
   * card opens the built-in ExecutionBottomSheet (disclaimer → OrderFormSheet).
   * Supplying onExecute disables the built-in sheet so a parent can host a
   * different flow (e.g. paper-trade confirmation).
   */
  onExecute?: (signal: RetailSignal) => void;
  /** From useMarketStress — when true, cards may surface high-VIX education. */
  isHighStress?: boolean;
  /**
   * DB-derived seen-education ids (from markets.behavioral_events). When this
   * prop is provided, per-card education triggers respect it; the feed-level
   * "high conviction" banner falls back to localStorage so the card still
   * appears on first visit even before behavioral_events syncs.
   */
  seenEducationIds?: Set<string>;
  /** Core (tier 2) drawdown — feeds the cooling-off interception on sells. */
  coreDrawdownTier?: AlertTier;
  coreDrawdownPct?: number;
  corePortfolioId?: string;
}

export function RetailSignalFeed({
  experienceLevel,
  onExecute,
  isHighStress = false,
  seenEducationIds,
  coreDrawdownTier,
  coreDrawdownPct,
  corePortfolioId,
}: RetailSignalFeedProps) {
  const [filters, setFilters] = useState<SignalFilterState>({
    assetClass:    undefined,
    horizon:       undefined,
    minConfidence: 0.60,
  });

  const [sheetSignal, setSheetSignal] = useState<RetailSignal | null>(null);
  const sheetOpen = sheetSignal !== null;

  const handleExecute = onExecute ?? ((signal) => setSheetSignal(signal));

  const { data: signals = [], isLoading, isError, error, refetch } = useRetailSignals({
    ...filters,
    limit: 30,
  });

  // Education: surface the "About this signal" card the first time a user
  // sees a High Conviction signal. Once dismissed it's recorded in localStorage
  // (via useInlineEducation) and never shown again.
  const { hasBeenShown, markShown } = useInlineEducation();
  const hasHighConviction = useMemo(
    () => signals.some((s) => (s.confidence ?? 0) >= HIGH_CONVICTION_THRESHOLD),
    [signals],
  );
  const showHighConvictionEducation =
    hasHighConviction && !hasBeenShown('high_conviction_signal');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Signals</h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {signals.length} available
        </span>
      </div>

      <SignalFilter filters={filters} onChange={setFilters} />

      {isLoading ? (
        <div className="space-y-3" aria-label="Loading signals">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="text-destructive">
            Failed to load signals
            {error instanceof Error ? ` — ${error.message}` : ''}.
          </p>
          <button
            type="button"
            className="mt-2 text-xs underline"
            onClick={() => refetch()}
          >
            Try again
          </button>
        </div>
      ) : signals.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No signals match your filters right now.
        </p>
      ) : (
        <div className="space-y-3">
          {showHighConvictionEducation && (
            <InlineEducation
              educationId="high_conviction_signal"
              experienceLevel={experienceLevel}
              onDismiss={markShown}
            />
          )}
          {signals.map((s) => (
            <SignalCard
              key={s.id}
              signal={s}
              experienceLevel={experienceLevel}
              onExecute={handleExecute}
              isHighStress={isHighStress}
              seenEducationIds={seenEducationIds}
            />
          ))}
        </div>
      )}

      {!onExecute && (
        <ExecutionBottomSheet
          signal={sheetSignal}
          open={sheetOpen}
          onOpenChange={(open) => {
            if (!open) setSheetSignal(null);
          }}
          coreDrawdownTier={coreDrawdownTier}
          coreDrawdownPct={coreDrawdownPct}
          corePortfolioId={corePortfolioId}
        />
      )}
    </div>
  );
}
