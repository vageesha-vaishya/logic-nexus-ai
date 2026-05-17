/**
 * DarkModeToggle — persisted dark/light mode switch.
 *
 * - Reads from localStorage key "lnai_dark_mode" on mount.
 * - Falls back to system prefers-color-scheme if no stored value.
 * - Manipulates document.documentElement.classList directly.
 *
 * Also exports useDarkMode() hook for reactive reading of current mode.
 */

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const LS_KEY = "lnai_dark_mode";

// ── Hook ──────────────────────────────────────────────────────────────────────

/** Reactively tracks whether dark mode is currently active. */
export function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  return isDark;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DarkModeToggleProps {
  className?: string;
}

export function DarkModeToggle({ className }: DarkModeToggleProps) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(LS_KEY);
    if (stored !== null) return stored === "true";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem(LS_KEY, String(isDark));
  }, [isDark]);

  return (
    <button
      type="button"
      onClick={() => setIsDark(d => !d)}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground",
        "hover:bg-accent hover:text-accent-foreground",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark
        ? <Sun  className="h-4 w-4" aria-hidden="true" />
        : <Moon className="h-4 w-4" aria-hidden="true" />}
      <span className="sr-only">{isDark ? "Switch to light mode" : "Switch to dark mode"}</span>
    </button>
  );
}
