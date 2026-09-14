#!/usr/bin/env node
// Runs the design-system verification harness (tests/design-system) one engine
// at a time and always regenerates REPORT.md afterwards.
//
// Why not a plain `playwright test && node generate-report.mjs`? Failures are
// the findings, so `&&` never reached the report; and a single `setup` login
// shared across a 1.5 h run outlived the Supabase refresh token, so the last
// engine silently ran against the login page. Each engine here gets its own
// `--project=setup`, i.e. a login < 25 min old.
//
//   node scripts/audit-design-system.mjs                 # chromium, firefox, webkit, msedge
//   node scripts/audit-design-system.mjs --quick         # chromium only
//   node scripts/audit-design-system.mjs --engines=webkit,msedge
//   node scripts/audit-design-system.mjs --workers=1        # halve browser memory on a busy machine
import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4173;
const SERVER_URL = `http://localhost:${PORT}/`;
const CONFIG = 'tests/design-system/playwright.design-system.config.ts';
const REPORT = 'docs/design-system/verification/generate-report.mjs';
const ALL_ENGINES = ['chromium', 'firefox', 'webkit', 'msedge'];

function parseEngines(argv) {
  if (argv.includes('--quick')) return ['chromium'];
  const flag = argv.find(a => a.startsWith('--engines='));
  if (!flag) return ALL_ENGINES;
  const engines = flag.slice('--engines='.length).split(',').map(s => s.trim()).filter(Boolean);
  const unknown = engines.filter(e => !ALL_ENGINES.includes(e));
  if (unknown.length) throw new Error(`unknown engine(s): ${unknown.join(', ')} (known: ${ALL_ENGINES.join(', ')})`);
  return engines;
}

async function isServing() {
  try {
    const res = await fetch(SERVER_URL, { signal: AbortSignal.timeout(2_000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServing()) return;
    await new Promise(r => setTimeout(r, 1_000));
  }
  throw new Error(`Vite did not answer on ${SERVER_URL} within ${timeoutMs / 1000}s`);
}

function startVite() {
  // DS_HARNESS=1 drops the dev CSP's `upgrade-insecure-requests` (vite.config.ts),
  // which otherwise makes WebKit upgrade the module script to https and never boot.
  const child = spawn(
    'npm',
    ['run', 'dev:vite', '--', '--host', '0.0.0.0', '--port', String(PORT), '--strictPort'],
    { cwd: REPO_ROOT, shell: true, stdio: 'inherit', env: { ...process.env, DS_HARNESS: '1' } },
  );
  child.on('exit', code => {
    if (code !== null && code !== 0) console.error(`[audit] vite exited with code ${code}`);
  });
  return child;
}

function killTree(child) {
  if (child.exitCode !== null) return;
  if (process.platform === 'win32') {
    // `shell: true` wraps npm in cmd.exe; taskkill /T reaches the node process underneath.
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

/**
 * Which backend microservices (scripts/services.config.json) answer their
 * health check right now. CRM pages render degraded data without them, so the
 * report records it as run metadata rather than letting it pass silently.
 */
async function backendServicesNote() {
  let services;
  try {
    services = JSON.parse(await readFile(path.join(REPO_ROOT, 'scripts', 'services.config.json'), 'utf8')).services;
  } catch {
    return 'Backend services: services.config.json unreadable; not probed.';
  }
  const up = [];
  const down = [];
  // Entries without a `command` (remote Supabase, tenant branding) are not started by services:start.
  for (const s of services.filter(s => s.command)) {
    const base = (s.urlEnv && process.env[s.urlEnv]) || s.defaultUrl;
    try {
      const res = await fetch(new URL(s.healthPath || '/', base), { signal: AbortSignal.timeout(3_000) });
      (res.ok ? up : down).push(s.id);
    } catch {
      down.push(s.id);
    }
  }
  return `Backend services (npm run services:start) up: ${up.join(', ') || 'none'}; down: ${down.join(', ') || 'none'}.`;
}

function runEngine(engine, workers) {
  console.log(`\n[audit] === ${engine} (with fresh setup login) ===\n`);
  const res = spawnSync(
    'npx',
    ['playwright', 'test', '-c', CONFIG, '--project=setup', `--project=${engine}`, ...(workers ? [`--workers=${workers}`] : [])],
    { cwd: REPO_ROOT, shell: true, stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_REUSE_EXISTING_SERVER: 'true' } },
  );
  const status = res.status ?? 1;
  console.log(`\n[audit] ${engine} exited ${status}`);
  return status;
}

async function main() {
  const engines = parseEngines(process.argv.slice(2));
  const workers = process.argv.find(a => a.startsWith('--workers='))?.slice('--workers='.length);
  console.log(`[audit] engines: ${engines.join(', ')}${workers ? `; workers: ${workers}` : ''}`);

  let vite = null;
  if (await isServing()) {
    console.log(`[audit] reusing the server already on ${SERVER_URL} (make sure it was started with DS_HARNESS=1)`);
  } else {
    vite = startVite();
    await waitForServer(180_000);
    console.log(`[audit] vite ready on ${SERVER_URL}`);
  }

  const started = Date.now();
  const servicesNote = await backendServicesNote();
  console.log(`[audit] ${servicesNote}`);
  const statuses = {};
  try {
    for (const engine of engines) statuses[engine] = runEngine(engine, workers);
  } finally {
    if (vite) killTree(vite);
  }

  const notes = [servicesNote, `Engines run: ${engines.join(', ')}; each with its own setup login.`, process.env.DS_REPORT_NOTES]
    .filter(Boolean).join(' | ');
  const report = spawnSync('node', [REPORT], { cwd: REPO_ROOT, stdio: 'inherit', env: { ...process.env, DS_REPORT_NOTES: notes } });
  if (report.status !== 0) console.error(`[audit] generate-report.mjs exited ${report.status}`);

  const minutes = Math.round((Date.now() - started) / 60_000);
  console.log(`\n[audit] done in ${minutes} min; engine exit codes: ${JSON.stringify(statuses)}`);
  const failed = Object.values(statuses).some(s => s !== 0) || report.status !== 0;
  process.exit(failed ? 1 : 0);
}

main().catch(err => {
  console.error(`[audit] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
