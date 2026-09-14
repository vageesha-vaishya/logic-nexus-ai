import { describe, it, expect } from 'vitest';
import { buildReport, expectedCellIds, stripAnsi, PAGE_KEYS, KEYBOARD_ENGINES } from './generate-report.mjs';

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
    keyboard: { passed: false, focusableCount: 47, stops: [{ index: 0, tag: 'a', role: null, name: 'Skip to content', visibleFocus: true, visible: true, inAriaHidden: false }], failures: ['stop #3 <button> "Filter" has no visible focus indicator'] } },
  { kind: 'aria', page: 'leads-list', route: '/dashboard/leads', engine: 'chromium', width: 1280, height: 800, mode: 'light', mainTextLength: 1834,
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
    expect(md).toContain('| leads-list | chromium | 1/47 | ❌ |');
  });

  it('keeps keyboard-only rows out of the matrix tables', () => {
    const withTour = [...cells, { kind: 'keyboard', page: 'dashboard-onboarding', route: '/dashboard', engine: 'chromium', width: 1280, height: 800, mode: 'light',
      keyboard: { passed: false, focusableCount: 40, stops: [], failures: ['focus confined to 2 of 40 focusable elements (possible trap/overlay)'] } }];
    const out = buildReport(withTour, meta);
    const matrixLight = out.split('## Matrix — light mode')[1].split('## Matrix — dark mode')[0];
    expect(matrixLight).not.toContain('dashboard-onboarding');
    expect(out).toMatch(/\| dashboard-onboarding \| chromium \| 0\/40 \| ❌ \|/);
  });

  it('highlights engine divergence when a gate passes in one engine and fails in another', () => {
    expect(md).toMatch(/Engine-specific divergences[\s\S]*\*\*leads-list\*\* 360px light: passes in webkit; fails in chromium, firefox/);
  });

  it('computes keyboard and aria divergences too, grouped by page and kind', () => {
    const mixed = [...cells,
      { kind: 'keyboard', page: 'leads-list', route: '/dashboard/leads', engine: 'webkit', width: 1280, height: 800, mode: 'light',
        keyboard: { passed: true, focusableCount: 20, stops: [], failures: [] } },
      { kind: 'aria', page: 'dashboard', route: '/dashboard', engine: 'chromium', width: 1280, height: 800, mode: 'light',
        aria: { passed: true, failures: [], snapshot: 'aria/dashboard-chromium.yaml' } },
      { kind: 'aria', page: 'dashboard', route: '/dashboard', engine: 'webkit', width: 1280, height: 800, mode: 'light',
        aria: { passed: false, failures: ['expected exactly one heading level=1, found 0'], snapshot: 'aria/dashboard-webkit.yaml' } },
      { kind: 'aria', page: 'dashboard', route: '/dashboard', engine: 'firefox', width: 1280, height: 800, mode: 'light', error: 'boom' },
    ];
    const out = buildReport(mixed, meta);
    expect(out).toContain('- **leads-list** keyboard (1280 light): passes in webkit; fails in chromium');
    expect(out).toContain('- **dashboard** aria (1280 light): passes in chromium; fails in webkit, firefox'); // an error cell counts as a failure
  });

  it('shows the rendered main-text length in the ARIA table', () => {
    expect(md).toContain('| Main text |');
    expect(md).toContain('| leads-list | chromium | ✅ | 1834 |  | [yaml](aria/leads-list-chromium.yaml) |');
    const noLength = buildReport([{ ...cells[4], mainTextLength: undefined }], meta);
    expect(noLength).toContain('| leads-list | chromium | ✅ | — |');
  });

  it('sorts keyboard and aria rows by page then engine', () => {
    const shuffled = [
      { kind: 'keyboard', page: 'themes', engine: 'webkit', width: 1280, height: 800, mode: 'light', keyboard: { passed: true, stops: [], failures: [] } },
      { kind: 'keyboard', page: 'auth', engine: 'webkit', width: 1280, height: 800, mode: 'light', keyboard: { passed: true, stops: [], failures: [] } },
      { kind: 'keyboard', page: 'auth', engine: 'chromium', width: 1280, height: 800, mode: 'light', keyboard: { passed: true, stops: [], failures: [] } },
      { kind: 'aria', page: 'themes', engine: 'msedge', width: 1280, height: 800, mode: 'light', aria: { passed: true, failures: [], snapshot: 'a.yaml' } },
      { kind: 'aria', page: 'auth', engine: 'webkit', width: 1280, height: 800, mode: 'light', aria: { passed: true, failures: [], snapshot: 'b.yaml' } },
      { kind: 'aria', page: 'auth', engine: 'firefox', width: 1280, height: 800, mode: 'light', aria: { passed: true, failures: [], snapshot: 'c.yaml' } },
    ];
    const out = buildReport(shuffled, meta);
    // "page/engine" of every data row in a section, in document order.
    const rowKeys = section => section.split('\n')
      .filter(l => /^\| (auth|themes) \|/.test(l))
      .map(l => l.split('|').slice(1, 3).map(x => x.trim()).join('/'));
    expect(rowKeys(out.split('## Keyboard walk')[1].split('## ARIA')[0])).toEqual(['auth/chromium', 'auth/webkit', 'themes/webkit']);
    expect(rowKeys(out.split('## ARIA structure')[1].split('## Engine')[0])).toEqual(['auth/firefox', 'auth/webkit', 'themes/msedge']);
  });

  it('states the WebKit link-tabbing caveat, and the lead-detail API caveat only when the toast was a stop', () => {
    expect(md).toMatch(/WebKit's Tab skips links/);
    expect(md).not.toContain('CRM API down');
    const withToast = [...cells, { kind: 'keyboard', page: 'lead-detail', engine: 'chromium', width: 1280, height: 800, mode: 'light',
      keyboard: { passed: false, stops: [{ index: 0, tag: 'li', role: null, name: 'Failed to load leadUnknown error', visibleFocus: false, visible: true, inAriaHidden: false }], failures: ['x'] } }];
    expect(buildReport(withToast, meta)).toContain('`lead-detail` was measured with the CRM API down');
    const gateRefused = [...cells, { kind: 'aria', page: 'lead-detail', engine: 'webkit', width: 1280, height: 800, mode: 'light',
      error: ['expect(received).toBeGreaterThan(expected)', '', 'Expected: > 50', 'Received: 14'].join(String.fromCharCode(10)) }];
    const out = buildReport(gateRefused, meta);
    expect(out).toContain('`lead-detail` was measured with the CRM API down');
    expect(out).toContain('aria lead-detail/webkit/1280/light: `expect(received).toBeGreaterThan(expected) — Expected: > 50 — Received: 14`');
  });

  it('tells the reader to install browsers and service dependencies', () => {
    expect(md).toContain('npx playwright install');
    expect(md).toMatch(/msedge must be installed system-wide/);
    expect(md).toMatch(/services\/\*.*npm install/);
  });

  it('exports the page and keyboard-engine lists the TS side asserts against', () => {
    expect(PAGE_KEYS).toHaveLength(10);
    expect(KEYBOARD_ENGINES).toEqual(['chromium', 'firefox', 'webkit']);
  });
});

describe('buildReport table cell escaping', () => {
  it('escapes a literal pipe in a keyboard failure so the table row stays intact', () => {
    const kbCells = [
      { kind: 'keyboard', page: 'leads-list', route: '/dashboard/leads', engine: 'chromium', width: 1280, height: 800, mode: 'light',
        keyboard: { passed: false, stops: [], failures: ['stop #2 <button> "Home | Settings" has no visible focus indicator'] } },
    ];
    const md = buildReport(kbCells, meta);
    expect(md).toContain('Home \\| Settings');
    const row = md.split('\n').find(l => l.startsWith('| leads-list | chromium |'));
    expect(row).toBeDefined();
    // 5 columns (Page | Engine | Stops | Result | First failure) means 6 unescaped
    // pipe delimiters, which split into 7 parts including the two empty string ends.
    const parts = row.split(/(?<!\\)\|/);
    expect(parts.length).toBe(7);
  });

  it('escapes a literal pipe in an aria failure', () => {
    const ariaCells = [
      { kind: 'aria', page: 'leads-list', route: '/dashboard/leads', engine: 'chromium', width: 1280, height: 800, mode: 'light',
        aria: { passed: false, failures: ['expected landmark "Nav | Main" not found'], snapshot: 'aria/leads-list-chromium.yaml' } },
    ];
    const md = buildReport(ariaCells, meta);
    expect(md).toContain('Nav \\| Main');
  });
});

describe('buildReport error rendering and completeness', () => {
  it('strips ANSI colour codes from errors and shows the line after the expect( header', () => {
    const ESC = String.fromCharCode(27);
    const error = `${ESC}[2mexpect(${ESC}[22m${ESC}[31mlocator${ESC}[39m${ESC}[2m).${ESC}[22mtoBeVisible${ESC}[2m()${ESC}[22m failed\n\nLocator: locator('#main-content')\nExpected: visible`;
    const errCells = [
      { kind: 'aria', page: 'themes', route: '/dashboard/themes', engine: 'webkit', width: 1280, height: 800, mode: 'light', error },
    ];
    const md = buildReport(errCells, meta);
    expect(md).not.toContain(ESC);
    expect(md).not.toMatch(/\[\d+m/);
    expect(stripAnsi('[2m literal brackets stay')).toBe('[2m literal brackets stay'); // ESC is mandatory
    expect(md).toContain("aria themes/webkit/1280/light: `expect(locator).toBeVisible() failed — Locator: locator('#main-content')`");
  });

  it('lists every expected cell that produced no result file', () => {
    const md = buildReport(cells, meta);
    // 393 expected minus the 5 fixture cells (3 matrix + 1 keyboard + 1 aria).
    expect(md).toMatch(/## Cells with no result file/);
    expect(md).toContain('- `matrix-leads-list-msedge-360-light`');
    expect(md).toContain('- `keyboard-dashboard-onboarding-webkit-1280-light`');
    expect(md).not.toContain('- `matrix-leads-list-chromium-360-light`');
    const listed = md.split('## Cells with no result file')[1].split('\n').filter(l => l.startsWith('- `')).length;
    expect(listed).toBe(expectedCellIds().length - cells.length);
  });

  it('notes viewport-only screenshots with the page height', () => {
    const tall = [{ kind: 'matrix', page: 'accounts-list', route: '/dashboard/accounts', engine: 'firefox', width: 1280, height: 800, mode: 'light',
      screenshot: 'screenshots/accounts-list/firefox-1280-light.png', screenshotMode: 'viewport', scrollHeight: 33048,
      layout: { passed: true, offenders: [] }, axe: { passed: true, violations: [], disabledRules: [] } }];
    expect(buildReport(tall, meta)).toContain('accounts-list firefox 1280 light: viewport screenshot — page is 33048px tall');
  });
});
