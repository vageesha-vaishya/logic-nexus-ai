/**
 * useSthiraShell — should the Sthira mobile shell (bottom tabs, FAB) render?
 *
 * Returns true when EITHER:
 *   - We're running inside the Capacitor native shell (Android/iOS), OR
 *   - The viewport is narrower than the mobile breakpoint (responsive web preview)
 *
 * Deliberately separate from `useIsMobile` (viewport-only): the existing
 * sidebar + dashboard layouts use useIsMobile to decide collapsed state,
 * which is a different decision from "render the Sthira mobile chrome".
 *
 * See docs/plans/2026-05-20-sthira-mobile-onboarding-and-markets-ux-design.md
 */
import * as React from "react";
import { Capacitor } from "@capacitor/core";

const MOBILE_BREAKPOINT = 768;

export function useSthiraShell(): boolean {
  const isNative = React.useMemo(() => {
    try {
      return Capacitor.isNativePlatform();
    } catch {
      // SSR / test environments where Capacitor isn't initialised
      return false;
    }
  }, []);

  const [isNarrow, setIsNarrow] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onChange = () => setIsNarrow(window.innerWidth < MOBILE_BREAKPOINT);
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    mql.addEventListener?.("change", onChange);
    // matchMedia change events don't fire reliably in jsdom and some embedded
    // webviews; resize is the dependable signal.
    window.addEventListener("resize", onChange);
    onChange();
    return () => {
      mql.removeEventListener?.("change", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, []);

  return isNative || isNarrow;
}
