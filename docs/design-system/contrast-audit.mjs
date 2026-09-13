// WCAG 2.1 contrast audit for the design tokens in src/index.css.
// Run after ANY token change:   node docs/design-system/contrast-audit.mjs
// Keep the two token tables below in sync with :root / .dark in index.css.
//
// Thresholds (WCAG 2.1 AA):
//   4.5:1  normal text (buttons/badges are 12-14px -> normal, even when bold)
//   3.0:1  large text (>=18.66px bold or >=24px) and UI component boundaries (1.4.11)

const LIGHT = {
  background: '0 0% 100%',
  card: '0 0% 100%',
  foreground: '222 47% 11%',
  mutedForeground: '215 16% 47%',
  muted: '210 40% 96%',
  secondary: '210 40% 96%',
  secondaryForeground: '222 47% 11%',
  primary: '217 91% 53%',
  primaryForeground: '0 0% 100%',
  accent: '197 71% 52%',
  accentForeground: '222 47% 11%',
  destructive: '0 84% 50%',
  destructiveForeground: '0 0% 100%',
  success: '142 71% 45%',
  successForeground: '222 47% 11%',
  warning: '38 92% 50%',
  warningForeground: '222 47% 11%',
  border: '214 32% 91%',
  input: '214 20% 58%',
  ring: '217 91% 53%',
  sidebarBackground: '0 0% 98%',
  sidebarForeground: '240 5.3% 26.1%',
};

const DARK = {
  background: '222 47% 9%',
  card: '222 35% 14%',
  foreground: '210 40% 98%',
  mutedForeground: '215 20% 70%',
  muted: '222 22% 18%',
  secondary: '222 25% 20%',
  secondaryForeground: '210 40% 98%',
  primary: '217 91% 53%',
  primaryForeground: '0 0% 100%',
  accent: '197 71% 52%',
  accentForeground: '222 47% 11%',
  destructive: '0 70% 48%',
  destructiveForeground: '0 0% 100%',
  success: '142 71% 45%',
  successForeground: '222 47% 11%',
  warning: '38 92% 50%',
  warningForeground: '222 47% 11%',
  border: '217 22% 28%',
  input: '217 20% 46%',
  ring: '217 91% 53%',
  sidebarBackground: '222 50% 7%',
  sidebarForeground: '210 25% 92%',
};

// [label, foregroundKey, backgroundKey, threshold]
const PAIRS = [
  ['foreground on background', 'foreground', 'background', 4.5],
  ['foreground on card', 'foreground', 'card', 4.5],
  ['muted-foreground on background', 'mutedForeground', 'background', 4.5],
  ['muted-foreground on card', 'mutedForeground', 'card', 4.5],
  ['secondary-foreground on secondary', 'secondaryForeground', 'secondary', 4.5],
  ['primary-foreground on primary', 'primaryForeground', 'primary', 4.5],
  ['accent-foreground on accent', 'accentForeground', 'accent', 4.5],
  ['destructive-foreground on destructive', 'destructiveForeground', 'destructive', 4.5],
  ['success-foreground on success', 'successForeground', 'success', 4.5],
  ['warning-foreground on warning', 'warningForeground', 'warning', 4.5],
  ['sidebar-foreground on sidebar-bg', 'sidebarForeground', 'sidebarBackground', 4.5],
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
function parse(t) {
  const [h, s, l] = t.trim().split(/\s+/).map(parseFloat);
  return luminance(hslToRgb(h, s, l));
}
function ratio(fg, bg) {
  const a = parse(fg), b = parse(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

let failures = 0;
for (const [mode, T] of [['LIGHT', LIGHT], ['DARK', DARK]]) {
  console.log(`\n=== ${mode} ===`);
  for (const [label, fgKey, bgKey, threshold] of PAIRS) {
    const r = ratio(T[fgKey], T[bgKey]);
    const status = threshold === 0 ? 'documented trade-off' : r >= threshold ? 'PASS' : 'FAIL';
    if (status === 'FAIL') failures++;
    console.log(`${label.padEnd(40)} ${r.toFixed(2).padStart(6)}:1   need ${threshold || '-'}   ${status}`);
  }
}
console.log(failures ? `\n${failures} FAILURE(S)` : '\nAll thresholds met.');
process.exit(failures ? 1 : 0);
