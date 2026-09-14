import type { Page } from '@playwright/test';
import type { FocusStop } from './results';

/**
 * Spec §3.4. Presses Tab up to `max` times from <body>. Each stop must be
 * visible, show a visible focus indicator (outline, or a box-shadow that
 * differs from its unfocused value), and not sit inside aria-hidden. A repeat
 * visit to a non-first element before the sequence wraps is a focus trap; a
 * wrap after visiting only a small fraction of the page's focusable elements
 * (an overlay such as the onboarding tour) is reported as confinement.
 */
export async function walkTabOrder(
  page: Page,
  max = 40,
): Promise<{ stops: FocusStop[]; failures: string[]; passed: boolean; focusableCount: number }> {
  const focusableCount = await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    document.querySelectorAll('[data-ds-walk]').forEach(el => el.removeAttribute('data-ds-walk'));
    const candidates = document.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    let n = 0;
    for (const el of candidates) {
      if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') continue;
      if (el.closest('[aria-hidden="true"]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      n++;
    }
    return n;
  });

  const stops: FocusStop[] = [];
  const failures: string[] = [];
  let wrappedToFirst = false;

  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate((index) => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return { wrapped: true as const };
      const seen = el.getAttribute('data-ds-walk');
      if (seen !== null) return { repeat: Number(seen) as number };
      el.setAttribute('data-ds-walk', String(index));

      const focused = getComputedStyle(el);
      const focusedOutline = focused.outlineStyle !== 'none' && parseFloat(focused.outlineWidth) > 0;
      const focusedShadow = focused.boxShadow;
      // Blur/refocus the same element to read its unfocused box-shadow without moving the sequence.
      el.blur();
      const unfocusedShadow = getComputedStyle(el).boxShadow;
      el.focus({ preventScroll: true });
      const visibleFocus = focusedOutline || (focusedShadow !== 'none' && focusedShadow !== unfocusedShadow);

      const r = el.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 && focused.visibility !== 'hidden' && focused.opacity !== '0';
      const inAriaHidden = !!el.closest('[aria-hidden="true"]');
      const name =
        el.getAttribute('aria-label') ||
        (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby')!)?.textContent) ||
        (el as HTMLInputElement).labels?.[0]?.textContent ||
        el.textContent ||
        (el as HTMLInputElement).placeholder ||
        '';
      return {
        stop: {
          index,
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role'),
          name: name.trim().replace(/\s+/g, ' ').slice(0, 60),
          visibleFocus,
          visible,
          inAriaHidden,
        } as FocusStop,
      };
    }, i);

    if ('wrapped' in stop) break;
    if ('repeat' in stop) {
      if (stop.repeat === 0) { wrappedToFirst = true; break; } // wrapped back to the first stop
      failures.push(`focus trap: returned to stop #${stop.repeat} at press ${i + 1}`);
      break;
    }
    stops.push(stop.stop);
    const s = stop.stop;
    if (!s.visible) failures.push(`stop #${s.index} <${s.tag}> "${s.name}" is not visible`);
    if (!s.visibleFocus) failures.push(`stop #${s.index} <${s.tag}> "${s.name}" has no visible focus indicator`);
    if (s.inAriaHidden) failures.push(`stop #${s.index} <${s.tag}> "${s.name}" is inside aria-hidden`);
  }

  if (stops.length === 0) failures.push('no element received focus');
  // A short cycle through a fraction of the focusable elements is an overlay/trap, not a complete sequence.
  if (wrappedToFirst && stops.length < max && stops.length <= Math.max(2, Math.floor(focusableCount * 0.5))) {
    failures.push(`focus confined to ${stops.length} of ${focusableCount} focusable elements (possible trap/overlay)`);
  }
  return { stops, failures, passed: failures.length === 0, focusableCount };
}
