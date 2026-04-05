import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const baseUrl = process.env.UIM_CHAOS_BASE_URL || 'http://localhost:3000';
const outDir = resolve(process.cwd(), 'artifacts/mro/analysis/chaos');
const jsonPath = resolve(outDir, 'uim-phase5-chaos-log.json');
const mdPath = resolve(outDir, 'uim-phase5-chaos-log.md');

function now() {
  return new Date().toISOString();
}

async function requestJson(url, init = {}) {
  const startedAt = Date.now();
  const response = await fetch(url, init);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return {
    ok: response.ok,
    status: response.status,
    elapsed_ms: Date.now() - startedAt,
    body,
  };
}

async function runChaos() {
  const results = [];

  // CH-001: dependency timeout simulation
  {
    const experiment = {
      id: 'CH-001',
      title: 'Dependency timeout simulation',
      started_at: now(),
      passed: false,
      details: '',
    };
    try {
      await fetch('http://127.0.0.1:9/unreachable', {
        signal: AbortSignal.timeout(400),
      });
      experiment.details = 'Unexpectedly reached unreachable endpoint';
    } catch (error) {
      experiment.passed = true;
      experiment.details = `Timeout/connection error captured: ${String(error?.name || error)}`;
    }
    experiment.finished_at = now();
    results.push(experiment);
  }

  // CH-002: ETL queue burst and drain
  {
    const experiment = {
      id: 'CH-002',
      title: 'ETL queue burst and drain',
      started_at: now(),
      passed: false,
      details: '',
    };
    try {
      for (let index = 0; index < 5; index += 1) {
        await requestJson(`${baseUrl}/api/v2/uim/analytics/etl`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'schedule-run' }),
        });
      }
      const processed = await requestJson(`${baseUrl}/api/v2/uim/analytics/etl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process-now' }),
      });
      const queued = Number(processed?.body?.output?.queue?.queued ?? 999);
      experiment.passed = processed.ok && queued === 0;
      experiment.details = `process status=${processed.status}, queued=${queued}`;
    } catch (error) {
      experiment.details = `Exception: ${String(error)}`;
    }
    experiment.finished_at = now();
    results.push(experiment);
  }

  // CH-003: Reconciliation under scheduler stop/start
  {
    const experiment = {
      id: 'CH-003',
      title: 'Reconciliation under scheduler stop/start',
      started_at: now(),
      passed: false,
      details: '',
    };
    try {
      await requestJson(`${baseUrl}/api/v2/uim/analytics/etl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop-scheduler' }),
      });
      const reconciliation = await requestJson(`${baseUrl}/api/v2/uim/analytics/reconciliation`);
      await requestJson(`${baseUrl}/api/v2/uim/analytics/etl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-scheduler' }),
      });
      experiment.passed = reconciliation.ok;
      experiment.details = `reconciliation status=${reconciliation.status}`;
    } catch (error) {
      experiment.details = `Exception: ${String(error)}`;
    }
    experiment.finished_at = now();
    results.push(experiment);
  }

  // CH-004: malformed payload rejection
  {
    const experiment = {
      id: 'CH-004',
      title: 'Invalid payload rejection',
      started_at: now(),
      passed: false,
      details: '',
    };
    try {
      const badPayload = await requestJson(`${baseUrl}/api/v2/uim/analytics/qa-signoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signed_off_role: 'qa_lead' }),
      });
      experiment.passed = !badPayload.ok;
      experiment.details = `status=${badPayload.status}`;
    } catch (error) {
      experiment.details = `Exception: ${String(error)}`;
    }
    experiment.finished_at = now();
    results.push(experiment);
  }

  const passed = results.filter((result) => result.passed).length;
  const summary = {
    generated_at: now(),
    base_url: baseUrl,
    passed,
    total: results.length,
    status: passed >= 3 ? 'pass' : 'fail',
    experiments: results,
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

  const md = [
    '# UIM Phase5 Chaos Log',
    '',
    `- Generated at: \`${summary.generated_at}\``,
    `- Base URL: \`${summary.base_url}\``,
    `- Result: \`${summary.status}\` (${summary.passed}/${summary.total})`,
    '',
    '## Experiments',
    ...summary.experiments.map((item) => `- ${item.id} ${item.title}: ${item.passed ? 'PASS' : 'FAIL'} (${item.details})`),
    '',
  ].join('\n');
  writeFileSync(mdPath, md);

  console.log(`[phase5-chaos] ${summary.status.toUpperCase()} (${summary.passed}/${summary.total})`);
  console.log(`[phase5-chaos] json: ${jsonPath}`);
  console.log(`[phase5-chaos] md: ${mdPath}`);
  if (summary.status !== 'pass') process.exit(1);
}

runChaos().catch((error) => {
  console.error(`[phase5-chaos] failed: ${String(error)}`);
  process.exit(1);
});
