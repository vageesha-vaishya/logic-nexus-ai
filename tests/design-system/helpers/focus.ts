import type { Page } from '@playwright/test';
import type { FocusStop } from './results';

/** Native segmented controls: Tab moves between the month/day/year (or hh/mm) fields while activeElement stays put. */
const SEGMENTED_INPUT_TYPES = ['date', 'time', 'datetime-local', 'month', 'week', 'number'];
/** Consecutive presses allowed to stay on one segmented control before it counts as a trap. */
const MAX_SAME_CONTROL_PRESSES = 3;

export interface WalkOptions {
  /** Playwright project name; drives the engine-specific wrap/reachability rules described below. */
  engine?: string;
}

type WalkWindow = Window & { __dsTabbable: () => HTMLElement[] };

/**
 * Spec §3.4. Presses Tab up to `max` times from <body>. Each stop must be
 * visible, show a visible focus indicator (an outline or box-shadow that
 * differs from its unfocused value), and not sit inside aria-hidden. A repeat
 * visit to a non-first element before the sequence wraps is a focus trap; a
 * wrap after visiting only a small fraction of the page's Tab-reachable
 * elements (an overlay such as the onboarding tour) is reported as confinement.
 *
 * Engine rules (all measured on /auth, not assumed):
 * - Chromium and WebKit land on <body> with `document.hasFocus()` false after
 *   the last stop.
 * - Firefox moves focus into the browser chrome while `activeElement`, `:focus`
 *   and `document.hasFocus()` all keep reporting the last element — so on
 *   Firefox a repeat of the immediately preceding stop that is also the last
 *   tabbable element in document order is a wrap, not a trap.
 * - WebKit's Tab skips links (Safari's Option+Tab reaches them; Playwright's
 *   WebKit on Windows does not honour Alt+Tab either). Links are therefore not
 *   counted as Tab-reachable on WebKit, and link focus visibility is not gated
 *   there.
 */
export async function walkTabOrder(
  page: Page,
  max = 40,
  { engine }: WalkOptions = {},
): Promise<{ stops: FocusStop[]; failures: string[]; passed: boolean; focusableCount: number }> {
  // The screenshot path disables animations; the focus-style comparison needs the same or a
  // `transition-all` element is sampled mid-transition and reads as "no visible focus".
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important;}' });

  const focusableCount = await page.evaluate((skipLinks) => {
    (window as unknown as WalkWindow).__dsTabbable = () => {
      const out: HTMLElement[] = [];
      const candidates = document.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      for (const el of candidates) {
        if (skipLinks && el.tagName === 'A') continue;
        if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') continue;
        if (el.closest('[aria-hidden="true"]')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        out.push(el);
      }
      return out;
    };
    (document.activeElement as HTMLElement | null)?.blur?.();
    document.querySelectorAll('[data-ds-walk]').forEach(el => el.removeAttribute('data-ds-walk'));
    return (window as unknown as WalkWindow).__dsTabbable().length;
  }, engine === 'webkit');

  const stops: FocusStop[] = [];
  const failures: string[] = [];
  let wrappedToFirst = false;
  let wrappedToBody = false;
  let sameControlPresses = 0;

  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(
      ([index, lastIndex, firefox, segmentedTypes]) => {
        const el = document.activeElement as HTMLElement | null;
        if (!document.hasFocus()) return { wrapped: true as const };
        if (!el || el === document.body) return { wrapped: true as const };
        const seen = el.getAttribute('data-ds-walk');
        if (seen !== null) {
          const repeat = Number(seen);
          if (repeat === lastIndex) {
            if (el.tagName === 'INPUT' && segmentedTypes.includes((el as HTMLInputElement).type)) {
              return { sameControl: true as const };
            }
            if (firefox) {
              const tabbable = (window as unknown as WalkWindow).__dsTabbable();
              if (tabbable[tabbable.length - 1] === el) return { wrapped: true as const };
            }
          }
          return { repeat };
        }
        el.setAttribute('data-ds-walk', String(index));

        const outlineOf = (s: CSSStyleDeclaration) => ({
          style: s.outlineStyle, width: s.outlineWidth, color: s.outlineColor, offset: s.outlineOffset,
        });
        const focused = getComputedStyle(el);
        const focusedOutline = outlineOf(focused);
        const focusedShadow = focused.boxShadow;
        // Blur/refocus the same element to read its unfocused styles without moving the sequence.
        el.blur();
        const unfocused = getComputedStyle(el);
        const unfocusedOutline = outlineOf(unfocused);
        const unfocusedShadow = unfocused.boxShadow;
        el.focus({ preventScroll: true });

        // An outline only counts when it can be seen — a style, a width and a non-transparent colour
        // (Tailwind's `outline-none` is `2px solid transparent`) — and when it differs from the
        // unfocused outline: an always-on border-like outline is not a focus indicator.
        const transparent = (c: string) => c === 'transparent' || /^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)$/.test(c);
        const outlineRenders =
          focusedOutline.style !== 'none' && parseFloat(focusedOutline.width) > 0 && !transparent(focusedOutline.color);
        const outlineChanged =
          focusedOutline.style !== unfocusedOutline.style ||
          focusedOutline.width !== unfocusedOutline.width ||
          focusedOutline.color !== unfocusedOutline.color ||
          focusedOutline.offset !== unfocusedOutline.offset;
        const shadowChanged = focusedShadow !== 'none' && focusedShadow !== unfocusedShadow;
        const visibleFocus = (outlineRenders && outlineChanged) || shadowChanged;

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
      },
      [stops.length, stops.length - 1, engine === 'firefox', SEGMENTED_INPUT_TYPES] as const,
    );

    if ('wrapped' in stop) { wrappedToBody = true; break; }
    if ('sameControl' in stop) {
      // Tab is walking the control's own segments (a date input takes exactly 3 presses in Chromium and
      // Firefox: two more segments plus the picker button); the press after the allowance is a trap.
      if (++sameControlPresses <= MAX_SAME_CONTROL_PRESSES) continue;
      failures.push(`focus trap: stayed on stop #${stops.length - 1} for ${sameControlPresses} presses`);
      break;
    }
    sameControlPresses = 0;
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
  // A short cycle through a fraction of the Tab-reachable elements is an overlay/trap, not a complete sequence.
  if ((wrappedToFirst || wrappedToBody) && stops.length < max && stops.length <= Math.max(2, Math.floor(focusableCount * 0.5))) {
    failures.push(`focus confined to ${stops.length} of ${focusableCount} focusable elements (possible trap/overlay)`);
  }
  return { stops, failures, passed: failures.length === 0, focusableCount };
}
