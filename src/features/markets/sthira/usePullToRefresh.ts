/**
 * usePullToRefresh — thin wrapper over TanStack Query refetch with a small
 * pull-down gesture handler for Capacitor / mobile web.
 *
 * Returns:
 *   - props to spread onto a scroll container (touchstart/touchmove/touchend)
 *   - `isRefreshing` flag so the UI can show a copper progress arc
 *   - `pullProgress` (0-1) — how far down the user has pulled, for animating
 *     a visual indicator before the gesture is committed.
 *
 * Trigger threshold: 80px pulled from a scrollTop of 0. Anything less and we
 * release without refreshing. Once committed, calls all provided refetch
 * functions in parallel and waits for them.
 *
 * This is a minimal first cut. PR 3 ships it for the Home tab; PR 4 may
 * extend with haptic feedback (@capacitor/haptics already a dep) and a
 * snap-back animation.
 */
import { useCallback, useRef, useState } from "react";

const PULL_TRIGGER_PX = 80;
const MAX_PULL_PX     = 120;

export interface UsePullToRefreshOptions {
  /** Refetch functions to call when the gesture commits. Run in parallel. */
  onRefresh: () => Promise<unknown> | unknown;
  /** Disable the gesture (e.g. when no data is loaded yet). */
  disabled?: boolean;
}

export function usePullToRefresh({ onRefresh, disabled = false }: UsePullToRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullPx, setPullPx] = useState(0);
  const startYRef = useRef<number | null>(null);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || isRefreshing) return;
      const el = e.currentTarget as HTMLElement;
      if (el.scrollTop > 0) return;
      startYRef.current = e.touches[0]?.clientY ?? null;
    },
    [disabled, isRefreshing],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startYRef.current == null) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startYRef.current;
      if (dy <= 0) {
        setPullPx(0);
        return;
      }
      setPullPx(Math.min(dy * 0.5, MAX_PULL_PX)); // 50% rubber-band
    },
    [],
  );

  const onTouchEnd = useCallback(async () => {
    const commit = pullPx >= PULL_TRIGGER_PX;
    startYRef.current = null;
    setPullPx(0);
    if (!commit) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [pullPx, onRefresh]);

  return {
    isRefreshing,
    pullProgress: Math.min(pullPx / PULL_TRIGGER_PX, 1),
    containerProps: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
