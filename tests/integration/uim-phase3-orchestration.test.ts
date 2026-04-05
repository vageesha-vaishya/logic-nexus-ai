import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';

const PORT = 3901;
const BASE = `http://localhost:${PORT}`;
let mockProcess: ChildProcessWithoutNullStreams | null = null;

async function waitForHealth(timeoutMs = 12000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${BASE}/api/v2/uim/health`);
      if (response.ok) return;
    } catch {
      // wait and retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('uim mock api did not become healthy in time');
}

describe('uim phase3 orchestration', () => {
  beforeAll(async () => {
    const scriptPath = path.resolve(process.cwd(), 'scripts/uim-mock-api.mjs');
    mockProcess = spawn('node', [scriptPath], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(PORT) },
      stdio: 'pipe',
    });
    await waitForHealth();
  }, 20000);

  afterAll(() => {
    if (mockProcess) {
      mockProcess.kill('SIGTERM');
      mockProcess = null;
    }
  });

  it('executes rest hardening -> webhook dispatch -> connector compatibility', async () => {
    const manifestsRes = await fetch(`${BASE}/api/v2/uim/connectors/manifests`);
    expect(manifestsRes.status).toBe(200);
    const manifestsBody = await manifestsRes.json();
    const manifests = Array.isArray(manifestsBody?.output?.connector_manifests)
      ? manifestsBody.output.connector_manifests
      : [];
    const amroConnector = manifests.find((item: Record<string, unknown>) => item.connector_id === 'amro-bridge');
    expect(amroConnector).toBeTruthy();

    const hardeningRes = await fetch(`${BASE}/api/v2/uim/integrations/rest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interface: 'rest-hardening-audit',
        expected_p95_ms: 300,
        observed_p95_ms: 220,
        expected_availability_percent: 99.9,
        observed_availability_percent: 99.95,
      }),
    });
    expect(hardeningRes.status).toBe(200);
    const hardeningBody = await hardeningRes.json();
    expect(hardeningBody?.output?.sla?.error_budget_status).toBe('within_budget');

    const registerRes = await fetch(`${BASE}/api/v2/uim/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'register-adapter',
        adapter_id: 'amro-phase3-adapter',
        provider: 'amro',
        target_url: 'https://example.com/amro-hook',
        secret_ref: 'vault://uim/amro-phase3-adapter',
        subscribed_events: ['uim.command.applied.v1'],
      }),
    });
    expect(registerRes.status).toBe(200);

    const dispatchRes = await fetch(`${BASE}/api/v2/uim/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'dispatch-event',
        adapter_id: 'amro-phase3-adapter',
        event_type: 'uim.command.applied.v1',
        payload: { command_id: 'cmd-phase3-1' },
      }),
    });
    expect(dispatchRes.status).toBe(200);
    const dispatchBody = await dispatchRes.json();
    expect(dispatchBody?.output?.status).toBe('queued');

    const compatibilityRes = await fetch(`${BASE}/api/v2/uim/integrations/rest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interface: 'contract-compatibility-report',
        consumer_module: String(amroConnector.connector_id),
        requested_schema_version: 'v0.6',
        provided_schema_version: 'v0.6',
      }),
    });
    expect(compatibilityRes.status).toBe(200);
    const compatibilityBody = await compatibilityRes.json();
    expect(compatibilityBody?.output?.compatibility_status).toBe('compatible');
  });
});
