/**
 * usePullToRefresh — pull-down gesture handler for Capacitor / mobile web.
 *
 * Returns:
 *   - `containerProps` to spread on a scroll container
 *   - `isRefreshing` flag (UI: copper progress arc)
 *   - `pullProgress` (0-1) — gesture progress for visual indicator
 *   - `pullOffsetPx` — currently-applied translate-Y in px, animated during
 *     snap-back so callers can render a smooth retract
 *
 * Threshold: 80px pulled from a scrollTop of 0. Below threshold → silent
 * release. At threshold → haptic `impact: medium` and refresh runs.
 *
 * Snap-back animation: on release we ease pullPx → 0 over 220ms (cubic
 * out). The container reads `pullOffsetPx` directly so the parent can
 * animate without React Transition complexity.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";

const PULL_TRIGGER_PX = 80;
const MAX_PULL_PX     = 120;
const SNAP_DURATION_MS = 220;

async function tryHaptic(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // Plugin not available / web — silent.
  }
}

export interface UsePullToRefreshOptions {
  /** Refetch functions to call when the gesture commits. Run in parallel. */
  onRefresh: () => Promise<unknown> | unknown;
  /** Disable the gesture (e.g. when no data is loaded yet). */
  disabled?: boolean;
}

export function usePullToRefresh({ onRefresh, disabled = false }: UsePullToRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullPx, setPullPx] = useState(0);
  const startYRef       = useRef<number | null>(null);
  const animFrameRef    = useRef<number | null>(null);
  const animFromRef     = useRef<number>(0);
  const animStartTsRef  = useRef<number>(0);

  // Cancel any in-flight snap-back animation when the component unmounts.
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  /** Cubic-out easing — quick to start, soft landing. */
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);

  const animateSnapBack = useCallback((from: number) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFromRef.current    = from;
    animStartTsRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = now - animStartTsRef.current;
      const t = Math.min(1, elapsed / SNAP_DURATION_MS);
      const eased = animFromRef.current * (1 - ease(t));
      setPullPx(eased);
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        animFrameRef.current = null;
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || isRefreshing) return;
      const el = e.currentTarget as HTMLElement;
      if (el.scrollTop > 0) return;
      startYRef.current = e.touches[0]?.clientY ?? null;
      // Interrupt any snap-back animation if the user grabs again mid-retract.
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
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
    const releasePx = pullPx;
    const commit = releasePx >= PULL_TRIGGER_PX;
    startYRef.current = null;
    // Always animate back to 0 (whether committed or not).
    animateSnapBack(releasePx);
    if (!commit) return;
    void tryHaptic();
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [pullPx, animateSnapBack, onRefresh]);

  return {
    isRefreshing,
    pullProgress: Math.min(pullPx / PULL_TRIGGER_PX, 1),
    pullOffsetPx: pullPx,
    containerProps: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
