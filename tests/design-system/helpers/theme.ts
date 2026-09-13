import { expect, type Page } from '@playwright/test';
import type { Mode } from '../pages';

const DARK_KEY = 'soslogicpro.darkMode';           // src/lib/theme-storage-keys.ts
const ACTIVE_KEY = 'soslogicpro.activeThemeName';  // src/hooks/useTheme.tsx
const PRESET: Record<Mode, string> = { light: 'Default Simple', dark: 'Default Dark' };
const TOUR_SEEN_KEY = 'has_seen_onboarding_tour';    // src/components/system/OnboardingTour.tsx

/**
 * Presets hard-declare `dark`, and ThemeProvider derives the mode from the
 * active preset before falling back to the stored toggle — so both keys must
 * agree or the toggle is ignored. Must be registered before navigation.
 */
export async function applyModeInitScript(
  page: Page,
  mode: Mode,
  { firstRun = false }: { firstRun?: boolean } = {},
): Promise<void> {
  await page.addInitScript(
    ([darkKey, activeKey, isDark, preset]) => {
      localStorage.setItem(darkKey, isDark);
      localStorage.setItem(activeKey, preset);
    },
    [DARK_KEY, ACTIVE_KEY, String(mode === 'dark'), PRESET[mode]] as const,
  );
  if (!firstRun) await applyE2EStateInitScript(page);
  await stubSavedTheme(page);
}

/**
 * The E2E admin has a user-scoped saved theme (`ui_themes`, "Custom Theme",
 * dark:false) that ThemeProvider applies 1.5–3 s after boot, overriding the
 * requested mode on every engine. The baseline measures the design system's
 * default tokens, not one account's preset, so the fetch is answered with an
 * empty list. Observed request: `<supabase>/rest/v1/ui_themes?select=…&scope=eq.user&user_id=eq.…`.
 */
export async function stubSavedTheme(page: Page): Promise<void> {
  await page.route(/\/rest\/v1\/ui_themes(\?|$)/, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
}

/**
 * Marks the onboarding tour as seen. Without this the Joyride tour overlays
 * every authenticated route for the E2E admin and captures focus, so every
 * keyboard walk measures the tour's two buttons instead of the page.
 * keyboard.spec.ts has one dedicated `firstRun` cell that skips this on purpose.
 */
export async function applyE2EStateInitScript(page: Page): Promise<void> {
  await page.addInitScript((key) => localStorage.setItem(key, 'true'), TOUR_SEEN_KEY);
}

/**
 * Fails loudly if the app rendered the other mode (e.g. a server-side theme
 * override). Specs call it twice: after the page booted, and again right before
 * capture — a late flip must turn the cell into an error, never a pass.
 */
export async function expectMode(page: Page, mode: Mode): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')), { timeout: 10_000 })
    .toBe(mode === 'dark');
}
