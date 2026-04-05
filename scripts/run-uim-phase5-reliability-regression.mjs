import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const cycles = Math.max(1, Number.parseInt(String(process.env.UIM_RELIABILITY_CYCLES || '2'), 10) || 2);
const outDir = resolve(process.cwd(), 'artifacts/mro/analysis/reliability');
const jsonPath = resolve(outDir, 'uim-phase5-reliability-regression.json');
const mdPath = resolve(outDir, 'uim-phase5-reliability-regression.md');

const suites = [
  ['src/pages/api/v2/uim/analytics/kpis.test.ts'],
  ['src/pages/api/v2/uim/analytics/etl.test.ts'],
  ['src/pages/api/v2/uim/analytics/reconciliation.test.ts'],
  ['src/pages/api/v2/uim/analytics/qa-signoff.test.ts'],
  ['src/pages/api/v2/uim/analytics/sla-evidence.test.ts'],
  ['src/modules/uim/forms/UimForms.test.tsx'],
];

function runSuite(paths) {
  const start = Date.now();
  const result = spawnSync('npm', ['run', 'test', '--', ...paths], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const elapsedMs = Date.now() - start;
  return {
    ok: result.status === 0,
    elapsed_ms: elapsedMs,
    stdout_tail: String(result.stdout || '').slice(-1200),
    stderr_tail: String(result.stderr || '').slice(-1200),
  };
}

const runs = [];
for (let cycle = 1; cycle <= cycles; cycle += 1) {
  for (const suite of suites) {
    const suiteRun = runSuite(suite);
    runs.push({
      cycle,
      suite: suite.join(' '),
      ...suiteRun,
    });
    if (!suiteRun.ok) {
      break;
    }
  }
  if (runs.some((run) => run.cycle === cycle && !run.ok)) break;
}

const failed = runs.filter((run) => !run.ok).length;
const status = failed === 0 ? 'pass' : 'fail';
const summary = {
  generated_at: new Date().toISOString(),
  cycles_requested: cycles,
  total_runs: runs.length,
  failed_runs: failed,
  status,
  runs,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');

const md = [
  '# UIM Phase5 Reliability Regression',
  '',
  `- Generated at: \`${summary.generated_at}\``,
  `- Cycles requested: \`${summary.cycles_requested}\``,
  `- Total runs: \`${summary.total_runs}\``,
  `- Failed runs: \`${summary.failed_runs}\``,
  `- Status: \`${summary.status}\``,
  '',
  '## Run Log',
  ...runs.map((run) => `- cycle ${run.cycle} | ${run.suite} | ${run.ok ? 'PASS' : 'FAIL'} | ${run.elapsed_ms}ms`),
  '',
].join('\n');
writeFileSync(mdPath, md, 'utf8');

console.log(`[phase5-reliability] status=${summary.status} total=${summary.total_runs} failed=${summary.failed_runs}`);
console.log(`[phase5-reliability] json: ${jsonPath}`);
console.log(`[phase5-reliability] md: ${mdPath}`);
if (summary.status !== 'pass') process.exit(1);
