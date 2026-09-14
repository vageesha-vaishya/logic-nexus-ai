import { describe, it, expect } from 'vitest';
import { PAGES, VIEWPORTS, MODES, screenshotRelPath, ariaRelPath } from './pages';
import { PAGE_KEYS } from '../../docs/design-system/verification/generate-report.mjs';

describe('design-system page set', () => {
  it('has 10 pages with unique keys', () => {
    expect(PAGES).toHaveLength(10);
    expect(new Set(PAGES.map(p => p.key)).size).toBe(10);
  });

  it('matches the page list the report generator expects (it cannot import this TS file)', () => {
    expect(PAGES.map(p => p.key)).toEqual(PAGE_KEYS);
  });

  it('marks only /auth as unauthenticated', () => {
    expect(PAGES.filter(p => !p.authenticated).map(p => p.key)).toEqual(['auth']);
  });

  it('defines the four spec viewports and two modes', () => {
    expect(VIEWPORTS.map(v => v.width)).toEqual([360, 768, 1280, 1920]);
    expect(MODES).toEqual(['light', 'dark']);
  });

  it('builds stable, path-safe artifact names', () => {
    expect(screenshotRelPath('leads-list', 'webkit', 360, 'dark'))
      .toBe('screenshots/leads-list/webkit-360-dark.png');
    expect(ariaRelPath('lead-detail', 'firefox')).toBe('aria/lead-detail-firefox.yaml');
  });
});
