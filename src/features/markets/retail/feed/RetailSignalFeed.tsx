import { useState } from 'react';
import { SignalCard } from './SignalCard';
import { SignalFilter } from './SignalFilter';
import { useRetailSignals } from '../hooks/useRetailSignals';
import type { ExperienceLevel, RetailSignal } from '../types';

interface RetailSignalFeedProps {
  experienceLevel: ExperienceLevel;
  onExecute: (signal: RetailSignal) => void;
}

export function RetailSignalFeed({ experienceLevel, onExecute }: RetailSignalFeedProps) {
  const [filters, setFilters] = useState({
    assetClass: undefined as string | undefined,
    horizon: undefined as string | undefined,
    minConfidence: 0.60,
  });

  const { data: signals = [], isLoading, isError } = useRetailSignals({
    assetClass: filters.assetClass,
    horizon: filters.horizon,
    minConfidence: filters.minConfidence,
    limit: 30,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Signals</h3>
        <span className="text-xs text-muted-foreground">
          {signals.length} available
        </span>
      </div>
      <SignalFilter filters={filters} onChange={setFilters} />
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}
      {isError && (
        <p className="text-sm text-destructive">
          Failed to load signals. Is the markets worker running?
        </p>
      )}
      {!isLoading && signals.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No signals match your filters right now.
        </p>
      )}
      <div className="space-y-3">
        {signals.map((s) => (
          <SignalCard
            key={s.id}
            signal={s}
            experienceLevel={experienceLevel}
            onExecute={onExecute}
          />
        ))}
      </div>
    </div>
  );
}
