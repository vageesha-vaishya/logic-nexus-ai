#!/usr/bin/env node
// Turns the harness's cell JSON (test-results/design-system/data/*.json) into
// docs/design-system/verification/REPORT.md. Pure `buildReport` + thin CLI.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const DATA_DIR = path.join(REPO_ROOT, 'test-results', 'design-system', 'data');
const OUT = path.join(HERE, 'REPORT.md');

const ENGINES = ['chromium', 'firefox', 'webkit', 'msedge'];
const WIDTHS = [360, 768, 1280, 1920];
const MODES = ['light', 'dark'];
// Mirrors tests/design-system/pages.ts (this file can't import the TS). Keep in sync.
export const PAGE_KEYS = [
  'auth', 'dashboard', 'leads-list', 'lead-detail', 'leads-kanban',
  'contacts-list', 'accounts-list', 'opportunities-list', 'opportunity-new', 'themes',
];
const KEYBOARD_ENGINES = ['chromium', 'firefox', 'webkit']; // msedge is excluded via testIgnore
const DESKTOP_WIDTH = 1280;

const cellPassed = c => (c.layout?.passed ?? true) && (c.axe?.passed ?? true) && !c.error;

/** Markdown table cells: escape pipes and collapse newlines so dynamic text can't break the row. */
const cell = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

/** Playwright error messages carry ANSI colour codes; REPORT.md is plain Markdown. */
const ANSI = new RegExp(String.fromCharCode(27) + '?\\[[0-9;]*m', 'g');
export const stripAnsi = s => String(s ?? '').replace(ANSI, '');

/** One-line summary of an `error`: the first non-empty line after an `expect(` header, else the first line. */
export function errorSummary(error) {
  const lines = stripAnsi(error).split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return '';
  const header = lines.findIndex(l => /expect\(/.test(l));
  return (header >= 0 && lines[header + 1]) || lines[0];
}

/** Every cell id the full run should have produced: `${kind}-${page}-${engine}-${width}-${mode}`. */
export function expectedCellIds() {
  const ids = [];
  for (const p of PAGE_KEYS) for (const e of ENGINES) for (const w of WIDTHS) for (const m of MODES) ids.push(`matrix-${p}-${e}-${w}-${m}`);
  for (const p of [...PAGE_KEYS, 'dashboard-onboarding']) for (const e of KEYBOARD_ENGINES) ids.push(`keyboard-${p}-${e}-${DESKTOP_WIDTH}-light`);
  for (const p of PAGE_KEYS) for (const e of ENGINES) ids.push(`aria-${p}-${e}-${DESKTOP_WIDTH}-light`);
  return ids;
}
const cellId = c => `${c.kind}-${c.page}-${c.engine}-${c.width}-${c.mode}`;

export function buildReport(cells, meta) {
  const matrix = cells.filter(c => c.kind === 'matrix');
  const keyboard = cells.filter(c => c.kind === 'keyboard');
  const aria = cells.filter(c => c.kind === 'aria');
  const pages = [...new Set(cells.map(c => c.page))];
  const L = [];

  L.push('# Design System Verification Report');
  L.push('');
  L.push(`Generated ${meta.date} at commit \`${meta.commit}\` by \`npm run audit:design-system\`. **Do not edit by hand.**`);
  L.push('');
  L.push('## What this is — and is not');
  L.push('');
  L.push('- **Engines:** ' + ENGINES.map(e => `${e} ${meta.engines?.[e] ?? '?'}`).join(', ') + '.');
  L.push('- **WebKit stands in for Safari.** Same engine, but not Safari\'s shell, OS font stack, or iOS; a real Safari pass is still an open item.');
  L.push('- **ARIA snapshots are structure only** — this is not a screen-reader session (NVDA/JAWS/VoiceOver were not run); it catches missing names and landmarks, not announcement order or live regions.');
  L.push('- **Viewports** are emulated at 360/768/1280/1920; no real devices.');
  L.push('- Gates: layout integrity (no page-level horizontal scroll, no unscrolled overflow), axe-core WCAG 2.1 A/AA `serious`+`critical`, keyboard visible-focus/no-trap (1280 light), ARIA structure (1280 light). axe `moderate`/`minor` are reported, not gated.');
  L.push('');
  L.push('## Running');
  L.push('');
  L.push('```bash');
  L.push('# needs E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD in the gitignored repo-root `env` file');
  L.push('npm run audit:design-system          # all 4 engines');
  L.push('npm run audit:design-system:quick    # chromium only');
  L.push('```');
  L.push('');
  L.push('Start the backend services first (`npm run services:start`) or CRM pages render with degraded data.');
  L.push('');
  if (meta.notes?.length) {
    L.push('Run metadata:');
    for (const n of meta.notes) L.push(`- ${n}`);
    L.push('');
  }

  for (const mode of MODES) {
    L.push(`## Matrix — ${mode} mode`);
    L.push('');
    L.push('Cell = layout + axe gates for that page/engine/width. Click to open the screenshot.');
    L.push('');
    L.push('| Page | ' + ENGINES.flatMap(e => WIDTHS.map(w => `${e} ${w}`)).join(' | ') + ' |');
    L.push('|---|' + ENGINES.flatMap(() => WIDTHS.map(() => '---')).join('|') + '|');
    for (const p of pages) {
      const row = ENGINES.flatMap(e => WIDTHS.map(w => {
        const c = matrix.find(x => x.page === p && x.engine === e && x.width === w && x.mode === mode);
        if (!c) return '—';
        const mark = cellPassed(c) ? '✅' : '❌';
        return c.screenshot ? `[${mark}](${c.screenshot})` : mark;
      }));
      L.push(`| ${cell(p)} | ${row.join(' | ')} |`);
    }
    L.push('');
  }

  L.push('## axe-core violations by rule');
  L.push('');
  const byRule = new Map();
  for (const c of matrix) for (const v of c.axe?.violations ?? []) {
    const k = v.id;
    if (!byRule.has(k)) byRule.set(k, { ...v, cells: [] });
    byRule.get(k).cells.push(`${c.page}/${c.engine}/${c.width}/${c.mode}`);
  }
  const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  const rules = [...byRule.values()].sort((a, b) => order[a.impact] - order[b.impact] || b.cells.length - a.cells.length);
  if (!rules.length) L.push('_None._');
  for (const r of rules) {
    L.push(`### \`${r.id}\` — ${r.impact}${order[r.impact] <= 1 ? ' (gated)' : ''}`);
    L.push('');
    L.push(`${r.help} ([rule](${r.helpUrl}))`);
    L.push('');
    L.push(`Affected cells (${r.cells.length}): ${r.cells.slice(0, 24).join(', ')}${r.cells.length > 24 ? ', …' : ''}`);
    if (r.sampleTargets?.length) L.push(`Sample targets: \`${r.sampleTargets.join('`, `')}\``);
    L.push('');
  }
  const disabled = [...new Set(matrix.flatMap(c => (c.axe?.disabledRules ?? []).map(d => `\`${d.id}\` on ${c.page}: ${d.reason}`)))];
  if (disabled.length) { L.push('Disabled rules:'); for (const d of disabled) L.push(`- ${d}`); L.push(''); }

  L.push('## Layout failures');
  L.push('');
  const layoutFails = matrix.filter(c => c.layout && !c.layout.passed);
  if (!layoutFails.length) L.push('_None._');
  for (const c of layoutFails) {
    L.push(`- **${c.page}** ${c.engine} ${c.width}px ${c.mode}:`);
    for (const o of c.layout.offenders) L.push(`  - \`${o}\``);
  }
  L.push('');
  const viewportShots = matrix.filter(c => c.screenshotMode === 'viewport');
  if (viewportShots.length) {
    L.push('Screenshots that are viewport-only because the engine refused a full-page capture (the page height is itself a finding):');
    for (const c of viewportShots) L.push(`- ${c.page} ${c.engine} ${c.width} ${c.mode}: viewport screenshot — page is ${c.scrollHeight ?? '?'}px tall`);
    L.push('');
  }

  L.push('## Keyboard walk (1280, light)');
  L.push('');
  L.push('| Page | Engine | Stops | Result | First failure |');
  L.push('|---|---|---|---|---|');
  for (const c of keyboard) {
    const k = c.keyboard;
    L.push(`| ${cell(c.page)} | ${cell(c.engine)} | ${k?.stops.length ?? 0} | ${k?.passed ? '✅' : '❌'} | ${cell(k?.failures[0] ?? errorSummary(c.error))} |`);
  }
  L.push('');
  for (const c of keyboard) {
    if (!c.keyboard) continue;
    L.push(`<details><summary>${c.page} / ${c.engine} — tab order (${c.keyboard.stops.length} stops)</summary>`);
    L.push('');
    for (const s of c.keyboard.stops) L.push(`${s.index + 1}. \`${s.tag}${s.role ? `[role=${s.role}]` : ''}\` ${cell(s.name) || '_(unnamed)_'}${s.visibleFocus ? '' : ' — **no visible focus**'}`);
    for (const f of c.keyboard.failures) L.push(`- ❌ ${f}`);
    L.push('');
    L.push('</details>');
    L.push('');
  }

  L.push('## ARIA structure (1280, light)');
  L.push('');
  L.push('| Page | Engine | Result | Failures | Snapshot |');
  L.push('|---|---|---|---|---|');
  for (const c of aria) {
    const a = c.aria;
    L.push(`| ${cell(c.page)} | ${cell(c.engine)} | ${a?.passed ? '✅' : '❌'} | ${cell(a?.failures.join('; ') ?? errorSummary(c.error))} | ${a ? `[yaml](${a.snapshot})` : ''} |`);
  }
  L.push('');

  L.push('## Engine-specific divergences');
  L.push('');
  L.push('A gate that passes in at least one engine and fails in another for the same page/width/mode — the cross-browser findings.');
  L.push('');
  const groups = new Map();
  for (const c of matrix) {
    const k = `${c.page}|${c.width}|${c.mode}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  let any = false;
  for (const [k, cs] of groups) {
    const pass = cs.filter(cellPassed).map(c => c.engine);
    const fail = cs.filter(c => !cellPassed(c)).map(c => c.engine);
    if (pass.length && fail.length) {
      any = true;
      const [page, width, mode] = k.split('|');
      L.push(`- **${page}** ${width}px ${mode}: passes in ${pass.join(', ')}; fails in ${fail.join(', ')}`);
    }
  }
  if (!any) L.push('_None — every failure reproduces in all engines._');
  L.push('');

  const errored = cells.filter(c => c.error);
  if (errored.length) {
    L.push('## Cells that did not complete');
    L.push('');
    for (const c of errored) L.push(`- ${c.kind} ${c.page}/${c.engine}/${c.width}/${c.mode}: \`${errorSummary(c.error)}\``);
    L.push('');
  }

  // A cell with no JSON at all died before its `finally` (or the engine never ran) — it must not disappear silently.
  const present = new Set(cells.map(cellId));
  const missing = expectedCellIds().filter(id => !present.has(id));
  L.push('## Cells with no result file');
  L.push('');
  if (!missing.length) L.push('_None — every expected cell wrote a result._');
  for (const id of missing) L.push(`- \`${id}\``);
  L.push('');

  return L.join('\n');
}

function loadCells() {
  if (!fs.existsSync(DATA_DIR)) throw new Error(`${DATA_DIR} not found — run the Playwright suite first.`);
  const cells = [];
  for (const f of fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))) {
    try {
      cells.push({ kind: f.split('-')[0], ...JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')) });
    } catch (e) {
      console.error(`skipping unreadable cell file ${f}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return cells;
}

function engineVersions() {
  const out = {};
  try {
    const pw = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'node_modules', 'playwright-core', 'browsers.json'), 'utf8'));
    for (const b of pw.browsers) if (['chromium', 'firefox', 'webkit'].includes(b.name)) out[b.name] = b.browserVersion;
  } catch { /* leave unknown */ }
  out.msedge = 'system channel';
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { execSync } = await import('node:child_process');
  const commit = execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT }).toString().trim();
  // Free-text run facts the runner can't observe (e.g. whether backend services were up): `|`-separated.
  const notes = (process.env.DS_REPORT_NOTES ?? '').split('|').map(s => s.trim()).filter(Boolean);
  const md = buildReport(loadCells(), { date: new Date().toISOString().slice(0, 10), commit, engines: engineVersions(), notes });
  fs.writeFileSync(OUT, md + '\n');
  console.log(`wrote ${path.relative(REPO_ROOT, OUT)}`);
}
