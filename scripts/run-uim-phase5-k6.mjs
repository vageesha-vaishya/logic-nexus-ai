import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const mode = process.argv[2] || 'smoke';
const allowed = new Set(['smoke', 'baseline', 'target_2000']);
if (!allowed.has(mode)) {
  console.error(`[phase5-k6] invalid mode "${mode}". Allowed: smoke, baseline, target_2000`);
  process.exit(1);
}

const baseUrl = process.env.K6_UIM_BASE_URL || 'http://localhost:3000';
const summaryPath = resolve(process.cwd(), 'artifacts/mro/analysis/performance/uim-phase5-k6-summary.json');
const scriptPath = resolve(process.cwd(), 'tests/performance/uim-phase5-load.k6.js');
mkdirSync(resolve(process.cwd(), 'artifacts/mro/analysis/performance'), { recursive: true });

function hasCommand(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      K6_UIM_MODE: mode,
      K6_UIM_BASE_URL: baseUrl,
    },
  });
  if (typeof result.status === 'number' && result.status !== 0) process.exit(result.status);
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
}

if (!hasCommand('k6')) {
  console.error('[phase5-k6] local k6 binary is required for local performance runs.');
  console.error('[phase5-k6] install guidance: https://grafana.com/docs/k6/latest/set-up/install-k6/');
  console.error('[phase5-k6] macOS (Homebrew): brew install k6');
  process.exit(1);
}

console.log('[phase5-k6] running with local k6 binary');
run('k6', ['run', '--summary-export', summaryPath, scriptPath]);
