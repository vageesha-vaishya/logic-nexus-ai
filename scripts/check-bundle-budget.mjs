#!/usr/bin/env node
// check-bundle-budget — Phase 1 Addendum T23 (bundle gate).
//
// Walks dist/assets after a Vite build, computes the gzipped size of every
// .js chunk, and compares against thresholds in perf-budget.json:
//
//   - entry_kb_gz_max:       cap on the main entry chunk (the script tag's src)
//   - single_chunk_kb_gz_max: cap on the largest single chunk (vendor or feature)
//   - total_kb_gz_max:       cap on the sum of all .js chunks
//
// Exits non-zero on any failure so it can be chained into build scripts or
// CI. Pure stdlib (zlib + fs) — no install needed.
//
// Usage:
//   node scripts/check-bundle-budget.mjs               # checks ./dist
//   DIST=path/to/dist node scripts/check-bundle-budget.mjs

import { readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const ROOT      = process.cwd();
const DIST_DIR  = path.join(ROOT, process.env.DIST || "dist");
const BUDGET    = JSON.parse(readFileSync(path.join(ROOT, "perf-budget.json"), "utf8"));

function red(s)    { return `\x1b[31m${s}\x1b[0m`; }
function green(s)  { return `\x1b[32m${s}\x1b[0m`; }
function yellow(s) { return `\x1b[33m${s}\x1b[0m`; }
function bold(s)   { return `\x1b[1m${s}\x1b[0m`; }

const kb = (n) => (n / 1024).toFixed(1);

function detectEntry() {
  // Vite emits index.html (or markets.html etc.) at dist root; the entry script
  // is the <script type="module" src="..."> tag. Read it instead of guessing.
  const htmlNames = readdirSync(DIST_DIR).filter((f) => f.endsWith(".html"));
  for (const name of htmlNames) {
    const html = readFileSync(path.join(DIST_DIR, name), "utf8");
    const m = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);
    if (m) {
      // Trim leading slash and any path prefix to land inside dist/.
      return m[1].replace(/^\/+/, "");
    }
  }
  return null;
}

function listJsAssets() {
  const assetsDir = path.join(DIST_DIR, "assets");
  return readdirSync(assetsDir)
    .filter((f) => f.endsWith(".js"))
    .map((f) => {
      const full = path.join(assetsDir, f);
      const raw  = readFileSync(full);
      const gz   = gzipSync(raw).length;
      return {
        name:      f,
        rel:       path.join("assets", f),
        raw_bytes: raw.length,
        gz_bytes:  gz,
      };
    });
}

function main() {
  try {
    if (!statSync(DIST_DIR).isDirectory()) throw new Error();
  } catch {
    console.error(red(`✗ dist directory not found: ${DIST_DIR}`));
    process.exit(2);
  }

  const entryRel = detectEntry();
  if (!entryRel) {
    console.error(red("✗ Could not locate entry script in any *.html under dist/"));
    process.exit(2);
  }

  const chunks = listJsAssets();
  const entry  = chunks.find((c) => c.rel === entryRel || entryRel.endsWith(c.name));
  if (!entry) {
    console.error(red(`✗ Entry script ${entryRel} not found among dist/assets/*.js`));
    process.exit(2);
  }

  const total       = chunks.reduce((a, c) => a + c.gz_bytes, 0);
  // Largest *non-entry* chunk — entry is gated separately via entry_kb_gz_max.
  // This catches a feature/vendor chunk regression while letting the entry
  // grow within its own cap.
  const nonEntry    = chunks.filter((c) => c !== entry);
  const largest     = nonEntry.length
    ? nonEntry.reduce((m, c) => (c.gz_bytes > m.gz_bytes ? c : m), nonEntry[0])
    : entry;

  const failures = [];
  const checks   = [
    {
      label:      "Entry chunk",
      actual_kb:  entry.gz_bytes / 1024,
      max_kb:     BUDGET.entry_kb_gz_max,
      detail:     entry.name,
    },
    {
      label:      "Largest single chunk",
      actual_kb:  largest.gz_bytes / 1024,
      max_kb:     BUDGET.single_chunk_kb_gz_max,
      detail:     largest.name,
    },
    {
      label:      "Total gzipped JS",
      actual_kb:  total / 1024,
      max_kb:     BUDGET.total_kb_gz_max,
      detail:     `${chunks.length} chunks`,
    },
  ];

  console.log(bold("\n== Bundle budget check =="));
  for (const c of checks) {
    const pass = c.actual_kb <= c.max_kb;
    const mark = pass ? green("✓") : red("✗");
    const sizeStr = `${kb(c.actual_kb * 1024)} KB`;
    const capStr  = `${c.max_kb} KB`;
    console.log(`${mark} ${c.label.padEnd(22)} ${sizeStr.padStart(10)} / ${capStr.padStart(8)} cap   ${c.detail}`);
    if (!pass) failures.push(c);
  }

  // Always print the top-5 chunks so a regression is easy to attribute.
  console.log(bold("\nTop 5 chunks by gzipped size:"));
  [...chunks].sort((a, b) => b.gz_bytes - a.gz_bytes).slice(0, 5).forEach((c) => {
    console.log(`  ${kb(c.gz_bytes).padStart(7)} KB  ${c.name}`);
  });

  if (failures.length > 0) {
    console.error(red(`\n✗ Bundle budget exceeded on ${failures.length} check(s).`));
    console.error(yellow(
      "  Either trim the bundle (lazy-import, prune deps, split chunks) or " +
      "intentionally bump perf-budget.json with a rationale in the PR.",
    ));
    process.exit(1);
  }

  console.log(green("\n✓ All bundle budgets pass."));
}

main();
