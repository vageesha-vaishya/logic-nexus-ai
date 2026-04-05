import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';

const PORT = 3902;
const BASE = `http://localhost:${PORT}`;
let mockProcess: ChildProcessWithoutNullStreams | null = null;

async function waitForHealth(timeoutMs = 12000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${BASE}/api/v2/uim/health`);
      if (response.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('uim mock api did not become healthy in time');
}

describe('uim nightly connector compatibility', () => {
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

  it('validates AMRO and Freight compatibility contracts on v0.6', async () => {
    const manifestsRes = await fetch(`${BASE}/api/v2/uim/connectors/manifests`);
    expect(manifestsRes.status).toBe(200);
    const manifestsBody = await manifestsRes.json();
    const manifests = Array.isArray(manifestsBody?.output?.connector_manifests)
      ? manifestsBody.output.connector_manifests
      : [];
    const connectorIds = new Set(manifests.map((entry: Record<string, unknown>) => String(entry.connector_id || '')));
    expect(connectorIds.has('amro-bridge')).toBe(true);
    expect(connectorIds.has('freight-bridge')).toBe(true);

    for (const moduleName of ['amro-bridge', 'freight-bridge']) {
      const compatibilityRes = await fetch(`${BASE}/api/v2/uim/integrations/rest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interface: 'contract-compatibility-report',
          consumer_module: moduleName,
          requested_schema_version: 'v0.6',
          provided_schema_version: 'v0.6',
        }),
      });
      expect(compatibilityRes.status).toBe(200);
      const compatibilityBody = await compatibilityRes.json();
      expect(compatibilityBody?.output?.compatibility_status).toBe('compatible');
    }
  });
});
