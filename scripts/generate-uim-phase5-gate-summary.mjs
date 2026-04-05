import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function safeReadJson(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readNumber(input, fallback = 0) {
  const value = Number(input);
  return Number.isFinite(value) ? value : fallback;
}

const perfSummaryPath = resolve(process.cwd(), 'artifacts/mro/analysis/performance/uim-phase5-k6-summary.json');
const chaosPath = resolve(process.cwd(), 'artifacts/mro/analysis/chaos/uim-phase5-chaos-log.json');
const securityPath = resolve(process.cwd(), 'artifacts/mro/analysis/security/uim-phase5-vulnerability-closure-report.json');
const reliabilityPath = resolve(process.cwd(), 'artifacts/mro/analysis/reliability/uim-phase5-reliability-regression.json');

const outputDir = resolve(process.cwd(), 'artifacts/mro/analysis/phase5');
const outputJson = resolve(outputDir, 'uim-phase5-gate-summary.json');
const outputMd = resolve(outputDir, 'uim-phase5-gate-summary.md');

const perf = safeReadJson(perfSummaryPath);
const chaos = safeReadJson(chaosPath);
const security = safeReadJson(securityPath);
const reliability = safeReadJson(reliabilityPath);
const inputPresence = {
  performance_summary: perf !== null,
  chaos_log: chaos !== null,
  security_closure_report: security !== null,
  reliability_regression_report: reliability !== null,
};

const p95 = readNumber(perf?.metrics?.http_req_duration?.values?.['p(95)'], -1);
const p95Target = readNumber(process.env.UIM_PHASE5_P95_TARGET_MS, 2200);
const p95Pass = p95 > 0 && p95 <= p95Target;

const chaosPass = String(chaos?.status || '') === 'pass';
const cvePass = String(security?.status || '') === 'pass' && readNumber(security?.npm_audit?.critical, 999) === 0;
const reliabilityPass = String(reliability?.status || '') === 'pass';

const gates = {
  p95_sla_compliance: {
    pass: p95Pass,
    measured_p95_ms: p95,
    target_ms: p95Target,
    source: perf ? 'performance summary' : 'missing',
  },
  chaos_resilience: {
    pass: chaosPass,
    source: chaos ? 'chaos log' : 'missing',
  },
  zero_critical_cves: {
    pass: cvePass,
    critical_count: readNumber(security?.npm_audit?.critical, -1),
    source: security ? 'security closure report' : 'missing',
  },
  reliability_regression: {
    pass: reliabilityPass,
    failed_runs: readNumber(reliability?.failed_runs, -1),
    source: reliability ? 'reliability regression report' : 'missing',
  },
};

const overallPass = Object.values(gates).every((gate) => gate.pass === true);
const summary = {
  generated_at: new Date().toISOString(),
  phase: 'phase5',
  version_gate: 'v0.9',
  overall_status: overallPass ? 'pass' : 'fail',
  gates,
  input_presence: inputPresence,
  recommendation: overallPass
    ? 'All Phase 5 gates passed. Ready for v0.9 decision.'
    : 'One or more gates failed/missing. Complete remediation and rerun gates.',
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputJson, JSON.stringify(summary, null, 2), 'utf8');

const md = [
  '# UIM Phase5 Gate Summary',
  '',
  `- Generated at: \`${summary.generated_at}\``,
  `- Gate target: \`${summary.version_gate}\``,
  `- Overall status: \`${summary.overall_status}\``,
  '',
  '## Gate Checks',
  `- p95 SLA compliance: \`${gates.p95_sla_compliance.pass ? 'PASS' : 'FAIL'}\` (p95=${gates.p95_sla_compliance.measured_p95_ms}ms target<=${gates.p95_sla_compliance.target_ms}ms)`,
  `- chaos resilience: \`${gates.chaos_resilience.pass ? 'PASS' : 'FAIL'}\``,
  `- zero critical CVEs: \`${gates.zero_critical_cves.pass ? 'PASS' : 'FAIL'}\` (critical=${gates.zero_critical_cves.critical_count})`,
  `- reliability regression: \`${gates.reliability_regression.pass ? 'PASS' : 'FAIL'}\` (failed_runs=${gates.reliability_regression.failed_runs})`,
  '',
  '## Gate Input Presence',
  `- performance summary present: \`${summary.input_presence.performance_summary ? 'yes' : 'no'}\` (\`${perfSummaryPath}\`)`,
  `- chaos log present: \`${summary.input_presence.chaos_log ? 'yes' : 'no'}\` (\`${chaosPath}\`)`,
  `- security closure report present: \`${summary.input_presence.security_closure_report ? 'yes' : 'no'}\` (\`${securityPath}\`)`,
  `- reliability regression report present: \`${summary.input_presence.reliability_regression_report ? 'yes' : 'no'}\` (\`${reliabilityPath}\`)`,
  '',
  '## Recommendation',
  `- ${summary.recommendation}`,
  '',
].join('\n');

writeFileSync(outputMd, md, 'utf8');

console.log(`[phase5-gate] status=${summary.overall_status}`);
console.log(`[phase5-gate] json: ${outputJson}`);
console.log(`[phase5-gate] md: ${outputMd}`);
if (!overallPass) process.exit(1);
