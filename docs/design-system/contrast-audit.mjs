// WCAG 2.1 contrast audit for the design tokens in src/index.css.
//
//   node docs/design-system/contrast-audit.mjs
//
// Reads the live token values straight out of index.css's `:root` and
// `.dark` blocks (no hand-maintained copy to drift), so it genuinely gates
// token changes. Wired into lint-staged for the files that define or apply
// color tokens; exits non-zero on any failure.
//
// Thresholds (WCAG 2.1 AA):
//   4.5:1  normal text (buttons/badges are 12-14px -> normal, even when bold)
//   3.0:1  large text (>=18.66px bold or >=24px) and UI component boundaries (1.4.11)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../../src/index.css'), 'utf8');

// Pull `--name: H S% L%;` declarations out of one selector block. Only the
// first block matching the selector is used (`:root` appears once; `.dark`
// appears once at top level -- the Sthira `:root[data-sthira-theme]` blocks
// use a different selector and are ignored).
function tokensFor(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Could not find "${selector} {" in index.css`);
  let depth = 0, i = start + selector.length + 1, end = -1;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const block = css.slice(start, end);
  const out = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*([\d.]+\s+[\d.]+%\s+[\d.]+%)\s*;/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

const LIGHT = tokensFor(':root');
const DARK = { ...LIGHT, ...tokensFor('.dark') }; // .dark overrides :root; unset tokens inherit

// [label, foregroundToken, backgroundToken, threshold]. threshold 0 = report only.
const PAIRS = [
  ['foreground on background', 'foreground', 'background', 4.5],
  ['foreground on card', 'foreground', 'card', 4.5],
  ['muted-foreground on background', 'muted-foreground', 'background', 4.5],
  ['muted-foreground on card', 'muted-foreground', 'card', 4.5],
  ['secondary-foreground on secondary', 'secondary-foreground', 'secondary', 4.5],
  ['primary-foreground on primary', 'primary-foreground', 'primary', 4.5],
  ['accent-foreground on accent', 'accent-foreground', 'accent', 4.5],
  ['destructive-foreground on destructive', 'destructive-foreground', 'destructive', 4.5],
  ['success-foreground on success', 'success-foreground', 'success', 4.5],
  ['warning-foreground on warning', 'warning-foreground', 'warning', 4.5],
  ['sidebar-foreground on sidebar-bg', 'sidebar-foreground', 'sidebar-background', 4.5],
  ['title-strip-foreground on title-strip', 'title-strip-foreground', 'title-strip', 4.5],
  ['primary as icon/link on background', 'primary', 'background', 3.0],
  ['ring (focus) vs background', 'ring', 'background', 3.0],
  ['input border vs background', 'input', 'background', 3.0],
  ['input border vs card', 'input', 'card', 3.0],
  // Deliberately below 3:1 -- decorative divider, documented trade-off (README 5.2).
  ['border (decorative) vs background', 'border', 'background', 0],
];

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}
function luminance([r, g, b]) {
  const ch = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}
function lum(triple) {
  const [h, s, l] = triple.trim().split(/\s+/).map(parseFloat);
  return luminance(hslToRgb(h, s, l));
}
function ratio(fg, bg) {
  const a = lum(fg), b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

let failures = 0;
for (const [mode, T] of [['LIGHT', LIGHT], ['DARK', DARK]]) {
  console.log(`\n=== ${mode} ===`);
  for (const [label, fgKey, bgKey, threshold] of PAIRS) {
    const fg = T[fgKey], bg = T[bgKey];
    if (!fg || !bg) {
      console.log(`${label.padEnd(40)}  MISSING TOKEN (${!fg ? fgKey : bgKey})`);
      failures++;
      continue;
    }
    const r = ratio(fg, bg);
    const status = threshold === 0 ? 'documented trade-off' : r >= threshold ? 'PASS' : 'FAIL';
    if (status === 'FAIL') failures++;
    console.log(`${label.padEnd(40)} ${r.toFixed(2).padStart(6)}:1   need ${threshold || '-'}   ${status}`);
  }
}
console.log(failures ? `\n${failures} FAILURE(S) -- see docs/design-system/README.md section 5` : '\nAll thresholds met.');
process.exit(failures ? 1 : 0);
