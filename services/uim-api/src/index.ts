// Phase 7 UIM Step 3 — uim-api entrypoint.

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(serviceRoot, '..', '..');

dotenv.config({ path: path.join(workspaceRoot, '.env') });
dotenv.config({ path: path.join(workspaceRoot, '.env.local'), override: true });
dotenv.config({ path: path.join(serviceRoot, '.env'), override: true });

const PORT = Number(process.env.UIM_API_PORT || process.env.PORT || 3701);

async function startDlqPoller(): Promise<void> {
  const raw = process.env.UIM_DLQ_POLL_INTERVAL_SEC;
  const intervalSec = raw ? Number(raw) : 0;
  if (!Number.isFinite(intervalSec) || intervalSec <= 0) {
    // eslint-disable-next-line no-console
    console.log('[uim-api] DLQ poller disabled (set UIM_DLQ_POLL_INTERVAL_SEC to enable)');
    return;
  }
  const intervalMs = Math.max(15, intervalSec) * 1000;
  const { createClient } = await import('@supabase/supabase-js');
  const { runDlqTick } = await import('./services/dlq-processor.js');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    // eslint-disable-next-line no-console
    console.log('[uim-api] DLQ poller wanted but SUPABASE_URL/SERVICE_ROLE_KEY missing — skipping');
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  // eslint-disable-next-line no-console
  console.log(`[uim-api] DLQ poller enabled every ${intervalMs / 1000}s`);

  let running = false;
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const result = await runDlqTick({ supabase });
      if (result.scanned > 0 || result.errors.length > 0) {
        // eslint-disable-next-line no-console
        console.log('[uim-api] DLQ tick', {
          scanned: result.scanned,
          delivered: result.delivered,
          retry_scheduled: result.retry_scheduled,
          retired_as_permanent: result.retired_as_permanent,
          skipped_no_target: result.skipped_no_target,
          errors: result.errors.length,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[uim-api] DLQ tick crashed', err instanceof Error ? err.message : String(err));
    } finally {
      running = false;
    }
  };
  setInterval(() => { void tick(); }, intervalMs).unref();
}

app.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`[uim-api] listening on :${PORT}`);
  void startDlqPoller();
});
