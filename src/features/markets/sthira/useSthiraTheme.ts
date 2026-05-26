/**
 * useSthiraTheme — read + write the current Sthira palette.
 *
 * Persists via localStorage (sync, available in Capacitor WebView and on
 * web). The boot-time `applyPersistedSthiraTheme()` call in main.tsx
 * applies the stored value before React mounts so there's no flash of
 * the wrong palette.
 *
 * Theme switch = set a data attribute on <html>. The CSS variables under
 * :root[data-sthira-theme="<id>"] cascade into every Tailwind sthira-*
 * class via hsl(var(--sthira-*)), so no component needs to subscribe.
 */
import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_STHIRA_THEME,
  isSthiraThemeId,
  type SthiraThemeId,
} from "./themes";

const STORAGE_KEY = "sthira.theme";
const ATTR        = "data-sthira-theme";
const EVENT       = "sthira-theme-change";

function readStoredTheme(): SthiraThemeId {
  if (typeof window === "undefined") return DEFAULT_STHIRA_THEME;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isSthiraThemeId(raw) ? raw : DEFAULT_STHIRA_THEME;
  } catch {
    return DEFAULT_STHIRA_THEME;
  }
}

function writeTheme(id: SthiraThemeId): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(ATTR, id);
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* private-mode quota / disabled storage — accept the loss */
  }
  // Notify other useSthiraTheme instances in this tab.
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

/**
 * Apply the persisted theme (or the default) before React mounts.
 * Call from main.tsx so the first paint shows the right palette.
 */
export function applyPersistedSthiraTheme(): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(ATTR, readStoredTheme());
}

export function useSthiraTheme(): {
  theme:    SthiraThemeId;
  setTheme: (id: SthiraThemeId) => void;
} {
  const [theme, setThemeState] = useState<SthiraThemeId>(readStoredTheme);

  useEffect(() => {
    const onChange = (event: Event) => {
      const id = (event as CustomEvent<SthiraThemeId>).detail;
      if (isSthiraThemeId(id)) setThemeState(id);
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const setTheme = useCallback((id: SthiraThemeId) => {
    writeTheme(id);
    setThemeState(id);
  }, []);

  return { theme, setTheme };
}
