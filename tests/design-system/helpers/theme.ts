import { expect, type Page } from '@playwright/test';
import type { Mode } from '../pages';

const DARK_KEY = 'soslogicpro.darkMode';           // src/lib/theme-storage-keys.ts
const ACTIVE_KEY = 'soslogicpro.activeThemeName';  // src/hooks/useTheme.tsx
const PRESET: Record<Mode, string> = { light: 'Default Simple', dark: 'Default Dark' };

/**
 * Presets hard-declare `dark`, and ThemeProvider derives the mode from the
 * active preset before falling back to the stored toggle — so both keys must
 * agree or the toggle is ignored. Must be registered before navigation.
 */
export async function applyModeInitScript(page: Page, mode: Mode): Promise<void> {
  await page.addInitScript(
    ([darkKey, activeKey, isDark, preset]) => {
      localStorage.setItem(darkKey, isDark);
      localStorage.setItem(activeKey, preset);
    },
    [DARK_KEY, ACTIVE_KEY, String(mode === 'dark'), PRESET[mode]] as const,
  );
}

/** Fails loudly if the app rendered the other mode (e.g. a server-side theme override). */
export async function expectMode(page: Page, mode: Mode): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')), { timeout: 10_000 })
    .toBe(mode === 'dark');
}
