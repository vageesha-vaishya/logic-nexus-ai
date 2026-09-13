/**
 * Shared localStorage key for dark/light mode state.
 *
 * Used by:
 * - main.tsx / entrypoints/markets.tsx — pre-hydration FOUC-prevention
 *   script that sets the `dark` class before React mounts.
 * - useTheme.tsx's ThemeProvider — the single source of truth once
 *   mounted; also drives applyTheme()'s isDark-derived CSS variables
 *   (table colors, etc).
 *
 * Kept in its own dependency-free module so the pre-render script in
 * main.tsx doesn't need to import the full ThemeProvider module, while
 * both stay reading/writing the same key.
 */
export const DARK_MODE_STORAGE_KEY = 'soslogicpro.darkMode';
