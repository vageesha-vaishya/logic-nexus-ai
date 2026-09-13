import type { Page } from '@playwright/test';

/**
 * Spec §3.3.2: no page-level horizontal scroll, and no element wider than the
 * viewport unless an ancestor scrolls horizontally (tables/kanban may).
 * Runs in the browser; returns CSS-ish descriptions of offenders.
 */
export async function checkLayout(page: Page): Promise<{ passed: boolean; offenders: string[] }> {
  return page.evaluate(() => {
    const offenders: string[] = [];
    const vw = window.innerWidth;
    const doc = document.documentElement;
    if (doc.scrollWidth > vw) {
      offenders.push(`document scrollWidth ${doc.scrollWidth} > innerWidth ${vw}`);
    }

    const scrollsX = (el: Element): boolean => {
      const o = getComputedStyle(el).overflowX;
      return o === 'auto' || o === 'scroll';
    };
    const hasScrollingAncestor = (el: Element): boolean => {
      let cur = el.parentElement;
      while (cur && cur !== document.body) {
        if (scrollsX(cur)) return true;
        cur = cur.parentElement;
      }
      return false;
    };
    const describe = (el: Element): string => {
      const id = el.id ? `#${el.id}` : '';
      const cls = typeof el.className === 'string' && el.className
        ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
        : '';
      return `${el.tagName.toLowerCase()}${id}${cls}`;
    };

    const all = document.body.querySelectorAll<HTMLElement>('*');
    let reported = 0;
    for (const el of all) {
      if (reported >= 10) break;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // +1 tolerates sub-pixel rounding.
      if (r.right > vw + 1 && !hasScrollingAncestor(el) && getComputedStyle(el).position !== 'fixed') {
        offenders.push(`${describe(el)} right=${Math.round(r.right)} > ${vw}`);
        reported++;
      }
    }
    return { passed: offenders.length === 0, offenders };
  });
}
