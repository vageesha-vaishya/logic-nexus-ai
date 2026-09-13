import { describe, it, expect } from 'vitest';
import { buildReport } from './generate-report.mjs';

const meta = { date: '2026-09-13', commit: 'abc1234', engines: { chromium: '142.0', firefox: '145.0', webkit: '26.0', msedge: '142.0' } };

const cells = [
  { kind: 'matrix', page: 'leads-list', route: '/dashboard/leads', engine: 'chromium', width: 360, height: 800, mode: 'light',
    screenshot: 'screenshots/leads-list/chromium-360-light.png',
    layout: { passed: false, offenders: ['div.toolbar right=412 > 360'] },
    axe: { passed: true, violations: [{ id: 'region', impact: 'moderate', help: 'All page content should be contained by landmarks', helpUrl: 'https://x', nodes: 2, sampleTargets: ['div.foo'] }], disabledRules: [] } },
  { kind: 'matrix', page: 'leads-list', route: '/dashboard/leads', engine: 'firefox', width: 360, height: 800, mode: 'light',
    screenshot: 'screenshots/leads-list/firefox-360-light.png',
    layout: { passed: true, offenders: [] },
    axe: { passed: false, violations: [{ id: 'color-contrast', impact: 'serious', help: 'Elements must meet minimum color contrast ratio thresholds', helpUrl: 'https://y', nodes: 1, sampleTargets: ['span.badge'] }], disabledRules: [] } },
  { kind: 'matrix', page: 'leads-list', route: '/dashboard/leads', engine: 'webkit', width: 360, height: 800, mode: 'light',
    screenshot: 'screenshots/leads-list/webkit-360-light.png',
    layout: { passed: true, offenders: [] },
    axe: { passed: true, violations: [], disabledRules: [] } },
  { kind: 'keyboard', page: 'leads-list', route: '/dashboard/leads', engine: 'chromium', width: 1280, height: 800, mode: 'light',
    keyboard: { passed: false, stops: [{ index: 0, tag: 'a', role: null, name: 'Skip to content', visibleFocus: true, visible: true, inAriaHidden: false }], failures: ['stop #3 <button> "Filter" has no visible focus indicator'] } },
  { kind: 'aria', page: 'leads-list', route: '/dashboard/leads', engine: 'chromium', width: 1280, height: 800, mode: 'light',
    aria: { passed: true, failures: [], snapshot: 'aria/leads-list-chromium.yaml' } },
];

describe('buildReport', () => {
  const md = buildReport(cells, meta);

  it('states what stood in for Safari and screen readers', () => {
    expect(md).toMatch(/WebKit.*Safari/i);
    expect(md).toMatch(/not a .*screen[- ]reader/i);
  });

  it('renders a matrix row per page with pass/fail cells linking screenshots', () => {
    expect(md).toContain('| leads-list |');
    expect(md).toContain('[❌](screenshots/leads-list/chromium-360-light.png)'); // layout gate failed
    expect(md).toContain('[❌](screenshots/leads-list/firefox-360-light.png)');  // axe serious failed
    expect(md).toContain('[✅](screenshots/leads-list/webkit-360-light.png)');
  });

  it('groups axe violations by rule with impact and affected cells', () => {
    expect(md).toMatch(/color-contrast.*serious.*leads-list.*firefox/s);
    expect(md).toMatch(/region.*moderate/s);
  });

  it('lists layout offenders, keyboard failures and aria results', () => {
    expect(md).toContain('div.toolbar right=412 > 360');
    expect(md).toContain('has no visible focus indicator');
    expect(md).toContain('aria/leads-list-chromium.yaml');
  });

  it('highlights engine divergence when a gate passes in one engine and fails in another', () => {
    expect(md).toMatch(/Engine-specific divergences[\s\S]*\*\*leads-list\*\* 360px light: passes in webkit; fails in chromium, firefox/);
  });
});
