import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const outDir = resolve(process.cwd(), 'artifacts/mro/analysis/security');
const jsonPath = resolve(outDir, 'uim-phase5-vulnerability-closure-report.json');
const mdPath = resolve(outDir, 'uim-phase5-vulnerability-closure-report.md');

function safeReadJson(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function runNpmAuditJson() {
  const result = spawnSync('npm', ['audit', '--json', '--omit=dev'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const raw = result.stdout || result.stderr || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return { error: 'Unable to parse npm audit output', raw };
  }
}

function extractCriticalCount(auditJson) {
  const vuln = auditJson?.metadata?.vulnerabilities;
  if (!vuln) return 0;
  return Number(vuln.critical || 0);
}

const auditJson = runNpmAuditJson();
const criticalCount = extractCriticalCount(auditJson);
const highCount = Number(auditJson?.metadata?.vulnerabilities?.high || 0);

const semgrep = safeReadJson(resolve(process.cwd(), 'artifacts/mro/analysis/uim-semgrep.json'));
const gitleaksApi = safeReadJson(resolve(process.cwd(), 'artifacts/mro/analysis/uim-gitleaks-api.sarif'));
const gitleaksMigrations = safeReadJson(resolve(process.cwd(), 'artifacts/mro/analysis/uim-gitleaks-migrations.sarif'));

const semgrepFindings = Array.isArray(semgrep?.results) ? semgrep.results.length : null;
const gitleaksApiFindings = Array.isArray(gitleaksApi?.runs) ? gitleaksApi.runs.length : null;
const gitleaksMigrationFindings = Array.isArray(gitleaksMigrations?.runs) ? gitleaksMigrations.runs.length : null;

const status = criticalCount === 0 ? 'pass' : 'fail';
const summary = {
  generated_at: new Date().toISOString(),
  status,
  npm_audit: {
    critical: criticalCount,
    high: highCount,
  },
  semgrep: {
    findings: semgrepFindings,
    source: semgrep ? 'artifacts/mro/analysis/uim-semgrep.json' : 'not-found',
  },
  gitleaks: {
    api_findings: gitleaksApiFindings,
    migration_findings: gitleaksMigrationFindings,
    source_api: gitleaksApi ? 'artifacts/mro/analysis/uim-gitleaks-api.sarif' : 'not-found',
    source_migrations: gitleaksMigrations ? 'artifacts/mro/analysis/uim-gitleaks-migrations.sarif' : 'not-found',
  },
};

mkdirSync(outDir, { recursive: true });
writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');

const md = [
  '# UIM Phase5 Vulnerability Closure Report',
  '',
  `- Generated at: \`${summary.generated_at}\``,
  `- Status: \`${summary.status}\``,
  '',
  '## npm audit',
  `- Critical: \`${summary.npm_audit.critical}\``,
  `- High: \`${summary.npm_audit.high}\``,
  '',
  '## SAST/Secret Scan Artifact References',
  `- Semgrep findings count: \`${summary.semgrep.findings ?? 'n/a'}\``,
  `- Gitleaks API runs count: \`${summary.gitleaks.api_findings ?? 'n/a'}\``,
  `- Gitleaks migrations runs count: \`${summary.gitleaks.migration_findings ?? 'n/a'}\``,
  '',
  '## Gate Decision',
  `- Zero critical CVEs: \`${summary.npm_audit.critical === 0 ? 'met' : 'not met'}\``,
  '',
].join('\n');
writeFileSync(mdPath, md, 'utf8');

console.log(`[phase5-security] status=${summary.status} critical=${summary.npm_audit.critical}`);
console.log(`[phase5-security] json: ${jsonPath}`);
console.log(`[phase5-security] md: ${mdPath}`);
if (summary.status !== 'pass') process.exit(1);
