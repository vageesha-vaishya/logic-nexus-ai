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

async function startOutboxPoller(): Promise<void> {
  const raw = process.env.UIM_OUTBOX_POLL_INTERVAL_SEC;
  const intervalSec = raw ? Number(raw) : 0;
  if (!Number.isFinite(intervalSec) || intervalSec <= 0) {
    // eslint-disable-next-line no-console
    console.log('[uim-api] outbox poller disabled (set UIM_OUTBOX_POLL_INTERVAL_SEC to enable)');
    return;
  }
  const intervalMs = Math.max(5, intervalSec) * 1000;
  const { createClient } = await import('@supabase/supabase-js');
  const { runOutboxDispatchTick } = await import('./services/webhook-outbox.js');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    // eslint-disable-next-line no-console
    console.log('[uim-api] outbox poller wanted but SUPABASE_URL/SERVICE_ROLE_KEY missing — skipping');
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  // eslint-disable-next-line no-console
  console.log(`[uim-api] outbox poller enabled every ${intervalMs / 1000}s`);

  let running = false;
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const result = await runOutboxDispatchTick({ supabase });
      if (result.scanned > 0 || result.errors.length > 0) {
        // eslint-disable-next-line no-console
        console.log('[uim-api] outbox tick', {
          scanned: result.scanned,
          delivered: result.delivered,
          retired_permanent: result.retired_permanent,
          escalated_to_dlq: result.escalated_to_dlq,
          retried_in_outbox: result.retried_in_outbox,
          errors: result.errors.length,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[uim-api] outbox tick crashed', err instanceof Error ? err.message : String(err));
    } finally {
      running = false;
    }
  };
  setInterval(() => { void tick(); }, intervalMs).unref();
}

async function wireEtlPersistence(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    // eslint-disable-next-line no-console
    console.log('[uim-api] ETL persistence: SUPABASE_URL/SERVICE_ROLE_KEY missing — using in-memory');
    return;
  }
  const { createClient } = await import('@supabase/supabase-js');
  const { setUimEtlPersistenceAdapter, restoreUimEtlRunsFromPersistence } = await import('./services/etl-scheduler.js');
  const { createSupabaseEtlPersistenceAdapter } = await import('./services/etl-persistence.js');
  const supabase = createClient(supabaseUrl, supabaseKey);
  setUimEtlPersistenceAdapter(createSupabaseEtlPersistenceAdapter(supabase));
  await restoreUimEtlRunsFromPersistence();
  // eslint-disable-next-line no-console
  console.log('[uim-api] ETL persistence wired to uim.etl_runs');
}

// ADR-0013 Step 65: env-gated cross-module consumer for
// amro.work_order.parts_consumed → uim_inventory_ledger.
async function startCrossModuleConsumer(): Promise<void> {
  const enabled = String(process.env.UIM_CROSS_MODULE_CONSUMER_ENABLED ?? 'false').toLowerCase();
  if (!['1', 'true', 'yes', 'on'].includes(enabled)) {
    // eslint-disable-next-line no-console
    console.log('[uim-api] cross-module consumer disabled (set UIM_CROSS_MODULE_CONSUMER_ENABLED=true to enable)');
    return;
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    // eslint-disable-next-line no-console
    console.log('[uim-api] cross-module consumer wanted but SUPABASE_URL/SERVICE_ROLE_KEY missing — skipping');
    return;
  }
  const { uimCrossModuleConsumer } = await import('./services/cross-module-consumer.js');
  uimCrossModuleConsumer.start();
  // eslint-disable-next-line no-console
  console.log('[uim-api] cross-module consumer enabled');
}

app.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`[uim-api] listening on :${PORT}`);
  void wireEtlPersistence();
  void startDlqPoller();
  void startOutboxPoller();
  void startCrossModuleConsumer();
});
