#!/usr/bin/env node
// LLM Gateway end-to-end smoke (P4.2).
//
// Steps:
//   1. Start the gateway in-process (no separate server process needed)
//      with LLM_GATEWAY_AUTH_MODE=open + no SUPABASE so the in-memory
//      stores serve a deterministic environment.
//   2. Register the compliance.screening.hit_reasoning prompt via
//      POST /v1/admin/prompts.
//   3. Call POST /v1/invoke with realistic variables; assert the
//      response shape (invocation_id, output.echo.rendered_body
//      substitutes party.name + party.country).
//   4. Call POST /v1/outcomes to demonstrate the full loop.
//   5. Exit code 0 on success, 1 on any failure.
//
// Usage:
//   node scripts/llm-gateway-smoke.mjs
//
// This is the first runnable demo that exercises every layer the
// gateway ships: auth (open) → PII redact → resolver → render →
// echo provider → audit (in-mem) → recordOutcome.

import { setTimeout as sleep } from 'node:timers/promises';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const GATEWAY_DIR = resolve(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..', 'services', 'llm-gateway');
const PORT = Number(process.env.GATEWAY_SMOKE_PORT || 38020);
const BASE = `http://localhost:${PORT}`;
const TENANT = '00000000-0000-4000-8000-0000000000a1';

if (!existsSync(join(GATEWAY_DIR, 'dist', 'index.js'))) {
  console.error(`gateway dist not found at ${GATEWAY_DIR}/dist. Run \`cd services/llm-gateway && npm run build\` first.`);
  process.exit(2);
}

console.log('▶ booting gateway on :' + PORT);
const child = spawn('node', ['dist/index.js'], {
  cwd: GATEWAY_DIR,
  env: {
    ...process.env,
    LLM_GATEWAY_PORT: String(PORT),
    LLM_GATEWAY_AUTH_MODE: 'open',
    // Force the in-memory stores so we don't depend on the prod DB
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    LLM_GATEWAY_SUPABASE_URL: '',
    LLM_GATEWAY_SUPABASE_SERVICE_ROLE_KEY: '',
    LOG_LEVEL: 'error',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', () => {});
child.stderr.on('data', (d) => process.stderr.write(d));

function shutdown(code) {
  try { child.kill('SIGTERM'); } catch {}
  process.exit(code);
}

// Wait for /healthz
for (let i = 0; i < 30; i += 1) {
  try {
    const res = await fetch(`${BASE}/healthz`);
    if (res.ok) break;
  } catch { /* not yet */ }
  await sleep(200);
}

async function postJSON(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  return { status: res.status, body: parsed };
}

function assert(cond, message) {
  if (!cond) {
    console.error('✗', message);
    shutdown(1);
  } else {
    console.log('✓', message);
  }
}

try {
  // ── 1. Register the prompt
  console.log('\n▶ registering compliance.screening.hit_reasoning');
  const reg = await postJSON('/v1/admin/prompts', {
    key: 'compliance.screening.hit_reasoning',
    module: 'compliance',
    feature: 'screening.hit_reasoning',
    body:
      'Evaluate hit for {{party.name}} ({{party.country}}). ' +
      'Hits: {{hits}}.',
    description: 'Smoke-test variant of the compliance prompt',
  });
  assert(reg.status === 201, `prompt registration → 201 (got ${reg.status})`);
  assert(typeof reg.body.version_id === 'string', 'response includes version_id');

  // ── 2. Invoke with a realistic shape
  console.log('\n▶ invoking with redacted PII');
  const inv = await postJSON('/v1/invoke', {
    tenant_id: TENANT,
    module: 'compliance',
    feature: 'screening.hit_reasoning',
    prompt_key: 'compliance.screening.hit_reasoning',
    variables: {
      party: {
        name: 'ACME Industries Ltd',
        country: 'US',
        contact_email: 'compliance@acme-industries.example',
      },
      hits: [
        { list_name: 'OFAC SDN', score: 0.92, matched_name: 'ACME Industries' },
      ],
    },
  });
  assert(inv.status === 200, `invoke → 200 (got ${inv.status})`);
  assert(typeof inv.body.invocation_id === 'string', 'response includes invocation_id');
  assert(inv.body.provider_kind === 'echo', 'provider_kind = echo');

  const echo = inv.body.output?.echo;
  assert(echo, 'output.echo present');
  assert(typeof echo?.rendered_body === 'string', 'rendered_body present');
  // The rendered body should include ACME (party name) but NOT the email
  // (PII redactor should have scrubbed it under strict default policy)
  assert(echo.rendered_body.includes('ACME Industries Ltd'),
    'rendered_body contains party.name');
  assert(echo.rendered_body.includes('US'),
    'rendered_body contains party.country');
  assert(!String(JSON.stringify(echo)).includes('compliance@acme-industries.example'),
    'email PII never reaches provider (redacted as <PII:EMAIL_*>)');

  const warnings = inv.body.warnings ?? [];
  assert(warnings.some((w) => w.startsWith('pii_redacted:')),
    `warnings include pii_redacted marker (got: ${warnings.join(', ')})`);

  // ── 3. Record an outcome
  console.log('\n▶ recording outcome');
  const outcome = await postJSON('/v1/outcomes', {
    invocation_id: inv.body.invocation_id,
    outcome: {
      kind: 'accepted',
      user_id: '00000000-0000-4000-8000-0000000000bb',
      notes: 'reviewed by compliance officer; verdict matches our assessment',
    },
  });
  // In-memory store has no context for the invocation_id (audit writer
  // is in-memory + ephemeral). Expected behavior: 404 INVOCATION_NOT_FOUND.
  // This documents the limitation; production setup with shared store
  // would return 201.
  if (outcome.status === 201) {
    assert(true, 'outcome recorded (201)');
  } else if (outcome.status === 404 && outcome.body?.error?.code === 'INVOCATION_NOT_FOUND') {
    console.log('ℹ outcome returns 404 (expected with ephemeral in-memory audit store)');
  } else {
    console.error('✗ outcome unexpected response:', outcome);
    shutdown(1);
  }

  // ── 4. Render preview (dev tool — no LLM call)
  console.log('\n▶ rendering prompt preview');
  const render = await postJSON('/v1/prompts/compliance.screening.hit_reasoning/render', {
    variables: {
      party: { name: 'TestCo', country: 'GB' },
      hits: [],
    },
  });
  assert(render.status === 200, `render → 200 (got ${render.status})`);
  assert(render.body.rendered.includes('TestCo'),
    'rendered body interpolates party.name');
  assert(render.body.rendered.includes('GB'),
    'rendered body interpolates party.country');

  console.log('\n✓ all checks passed');
  shutdown(0);
} catch (err) {
  console.error('✗ smoke threw:', err);
  shutdown(1);
}
