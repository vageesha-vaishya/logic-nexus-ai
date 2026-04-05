import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';

const PORT = 3900;
const BASE = `http://localhost:${PORT}`;
let mockProcess: ChildProcessWithoutNullStreams | null = null;

async function waitForHealth(timeoutMs = 12000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${BASE}/api/v2/uim/health`);
      if (response.ok) return;
    } catch {
      // ignore and retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('uim mock api did not become healthy in time');
}

describe('uim command -> replay -> projection consistency', () => {
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

  it('keeps deterministic projection totals across receive, reserve and consume', async () => {
    const receiveRes = await fetch(`${BASE}/api/v2/uim/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command_type: 'RECEIVE',
        command_payload: {
          sku: 'ITM-1001',
          title: 'UIM Integration Test Item',
          quantity: 10,
        },
      }),
    });
    expect(receiveRes.status).toBe(200);
    const receiveBody = await receiveRes.json();
    const itemId = String(receiveBody?.output?.applied_output?.inventory_item_id || '');
    expect(itemId.length).toBeGreaterThan(0);

    const reserveRes = await fetch(`${BASE}/api/v2/uim/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command_type: 'RESERVE',
        command_payload: {
          inventory_item_id: itemId,
          quantity: 4,
        },
      }),
    });
    expect(reserveRes.status).toBe(200);

    const consumeRes = await fetch(`${BASE}/api/v2/uim/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command_type: 'CONSUME',
        command_payload: {
          inventory_item_id: itemId,
          quantity: 2,
        },
      }),
    });
    expect(consumeRes.status).toBe(200);

    const replayRes = await fetch(`${BASE}/api/v2/uim/projections/replay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(replayRes.status).toBe(200);
    const replayBody = await replayRes.json();
    expect(Number(replayBody?.output?.replayed_events || 0)).toBeGreaterThanOrEqual(3);

    const projectionsRes = await fetch(`${BASE}/api/v2/uim/projections/items?limit=50&offset=0`);
    expect(projectionsRes.status).toBe(200);
    const projectionsBody = await projectionsRes.json();
    const snapshots = Array.isArray(projectionsBody?.output?.snapshots) ? projectionsBody.output.snapshots : [];
    const snapshot = snapshots.find((row: Record<string, unknown>) => String(row.inventory_item_id || '') === itemId);
    expect(snapshot).toBeTruthy();
    expect(Number(snapshot.projected_available_quantity || 0)).toBe(6);
    expect(Number(snapshot.projected_reserved_quantity || 0)).toBe(2);
    expect(Number(snapshot.projected_consumed_quantity || 0)).toBe(2);
  });
});
