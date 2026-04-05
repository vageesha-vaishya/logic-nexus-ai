import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readJson(filePath) {
  let raw = '';
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`k6 summary file not found at ${filePath}. Run a k6 scenario first.`);
  }
  return JSON.parse(raw);
}

function readTemplate(filePath) {
  return readFileSync(filePath, 'utf8');
}

function metricValue(summary, key, selector) {
  return summary?.metrics?.[key]?.values?.[selector];
}

function safeNumber(input, fallback = 0) {
  const value = Number(input);
  return Number.isFinite(value) ? value : fallback;
}

const summaryPath = resolve(process.cwd(), process.env.UIM_PHASE5_K6_SUMMARY_PATH || 'artifacts/mro/analysis/performance/uim-phase5-k6-summary.json');
const templatePath = resolve(process.cwd(), process.env.UIM_PHASE5_SLA_TEMPLATE_PATH || 'artifacts/mro/analysis/templates/uim-phase5-sla-report-template.md');
const outputPath = resolve(process.cwd(), process.env.UIM_PHASE5_SLA_OUTPUT_PATH || 'artifacts/mro/analysis/performance/uim-phase5-sla-report.md');

const summary = readJson(summaryPath);
const template = readTemplate(templatePath);

const checksPassed = safeNumber(metricValue(summary, 'checks', 'passes'));
const checksTotal = checksPassed + safeNumber(metricValue(summary, 'checks', 'fails'));
const errorRate = safeNumber(metricValue(summary, 'http_req_failed', 'rate'));
const p95 = safeNumber(metricValue(summary, 'http_req_duration', 'p(95)'));
const avg = safeNumber(metricValue(summary, 'http_req_duration', 'avg'));

const p95Target = safeNumber(process.env.UIM_PHASE5_P95_TARGET_MS, 2200);
const errorRateTarget = safeNumber(process.env.UIM_PHASE5_ERROR_RATE_TARGET, 0.02);
const p95Pass = p95 > 0 && p95 <= p95Target;
const errorPass = errorRate <= errorRateTarget;

const replacements = {
  generated_at: new Date().toISOString(),
  mode: process.env.K6_UIM_MODE || 'unknown',
  base_url: process.env.K6_UIM_BASE_URL || 'unknown',
  checks_passed: String(checksPassed),
  checks_total: String(checksTotal),
  http_req_failed_rate: errorRate.toFixed(4),
  http_req_duration_p95: p95.toFixed(2),
  http_req_duration_avg: avg.toFixed(2),
  p95_target_ms: String(p95Target),
  p95_status: p95Pass ? 'PASS' : 'FAIL',
  error_rate_target: errorRateTarget.toFixed(4),
  error_rate_status: errorPass ? 'PASS' : 'FAIL',
  p95_gate: p95Pass ? 'met' : 'not met',
  reliability_gate: errorPass ? 'met' : 'not met',
  phase5_recommendation: p95Pass && errorPass ? 'Proceed to next hardening gate' : 'Tune bottlenecks and rerun scenarios',
};

let rendered = template;
for (const [key, value] of Object.entries(replacements)) {
  rendered = rendered.replaceAll(`{{${key}}}`, value);
}

mkdirSync(resolve(outputPath, '..'), { recursive: true });
writeFileSync(outputPath, rendered, 'utf8');
console.log(`[phase5-sla-report] wrote ${outputPath}`);
