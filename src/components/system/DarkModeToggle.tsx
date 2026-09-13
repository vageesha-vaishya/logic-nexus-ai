/**
 * DarkModeToggle — persisted dark/light mode switch.
 *
 * Delegates to useTheme()'s isDark/toggleDark so this button drives the
 * same source of truth as the ThemeProvider -- toggling here re-applies
 * the active theme's isDark-derived CSS variables (table colors, etc),
 * not just the `dark` class. Previously this held its own separate
 * state and localStorage key, which never synced with ThemeProvider.
 *
 * Also exports useDarkMode() hook for reactive reading of current mode.
 */

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

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
  const { isDark, toggleDark } = useTheme();

  return (
    <button
      type="button"
      onClick={() => toggleDark(!isDark)}
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
