#!/usr/bin/env node
// Rewrites hardcoded Tailwind palette badge pairs (bg-X-N text-X-M) to semantic status tones.
// Pure `rewriteClassString` + a CLI. Only exact same-hue pairs are rewritten; everything else is
// reported for manual review so meaning ("selected" vs "info") is judged by a human.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HUE_TO_TONE = {
  green: 'success', emerald: 'success', teal: 'success',
  yellow: 'warning', amber: 'warning', orange: 'warning',
  red: 'danger', rose: 'danger',
  blue: 'info', cyan: 'info', indigo: 'info',
  gray: 'neutral', slate: 'neutral',
  purple: 'special', violet: 'special',
};
const HUES = Object.keys(HUE_TO_TONE).join('|');
const PAIR = new RegExp(`\\bbg-(${HUES})-(\\d{2,3})(?:\\/\\d+)?\\s+text-(${HUES})-(\\d{2,3})\\b`, 'g');

export function rewriteClassString(input) {
  const manual = [];
  let output = input.replace(PAIR, (m, bgHue, _bgN, fgHue) => {
    if (bgHue !== fgHue) { manual.push(m); return m; }
    const tone = HUE_TO_TONE[bgHue];
    return `bg-status-${tone} text-status-${tone}-foreground`;
  });
  // Siblings of a rewritten pair: dark: overrides are dropped (tones carry dark mode); hover: surface → tone/80.
  for (const tone of new Set(Object.values(HUE_TO_TONE))) {
    if (!output.includes(`bg-status-${tone}`)) continue;
    const hues = Object.entries(HUE_TO_TONE).filter(([, t]) => t === tone).map(([h]) => h).join('|');
    output = output
      .replace(new RegExp(`\\s*dark:(?:bg|text|border)-(?:${hues})-\\d{2,3}(?:\\/\\d+)?`, 'g'), '')
      .replace(new RegExp(`\\bhover:bg-(?:${hues})-\\d{2,3}\\b`, 'g'), `hover:bg-status-${tone}/80`);
  }
  return { output: output.replace(/\s{2,}/g, ' '), manual };
}

const SUB_BRAND = /--sq-|--sthira-/;

export function rewriteFile(file, write) {
  const src = fs.readFileSync(file, 'utf8');
  if (SUB_BRAND.test(src)) return { file, skipped: 'sub-brand', changed: false, manual: [] };
  const manual = [];
  let changed = false;
  // Only touch string/template literals that look like class lists.
  const out = src.replace(/(["'`])([^"'`\n]*\b(?:bg|text)-(?:[a-z]+)-\d{2,3}\b[^"'`\n]*)\1/g, (m, q, body) => {
    const r = rewriteClassString(body);
    manual.push(...r.manual);
    if (r.output !== body) changed = true;
    return `${q}${r.output}${q}`;
  });
  if (changed && write) fs.writeFileSync(file, out);
  return { file, changed, manual, skipped: null };
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|__snapshots__/.test(e.name)) walk(p, acc); }
    else if (/\.(tsx?|jsx?)$/.test(e.name) && !/\.test\./.test(e.name)) acc.push(p);
  }
  return acc;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const roots = args.filter(a => !a.startsWith('--'));
  const files = (roots.length ? roots : ['src']).flatMap(r => fs.statSync(r).isDirectory() ? walk(r) : [r]);
  let changedCount = 0; const manualAll = [];
  for (const f of files) {
    const r = rewriteFile(f, write);
    if (r.changed) { changedCount++; console.log(`${write ? 'rewrote' : 'would rewrite'} ${f}`); }
    for (const m of r.manual) manualAll.push(`${f}: ${m}`);
  }
  console.log(`\n${changedCount} file(s) ${write ? 'rewritten' : 'to rewrite'}; ${manualAll.length} manual-review pair(s):`);
  for (const m of manualAll) console.log('  ' + m);
}
