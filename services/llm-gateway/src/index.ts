import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(serviceRoot, '..', '..');

dotenv.config({ path: path.join(workspaceRoot, '.env') });
dotenv.config({ path: path.join(workspaceRoot, '.env.local'), override: true });
dotenv.config({ path: path.join(serviceRoot, '.env'), override: true });

const PORT = Number(process.env.LLM_GATEWAY_PORT || process.env.PORT || 3020);

async function startFineTunePoller(): Promise<void> {
  const raw = process.env.LLM_GATEWAY_FT_POLL_INTERVAL_SEC;
  const intervalSec = raw ? Number(raw) : 0;
  if (!Number.isFinite(intervalSec) || intervalSec <= 0) {
    logger.info('llm-gateway: fine-tune poller disabled (set LLM_GATEWAY_FT_POLL_INTERVAL_SEC to enable)');
    return;
  }
  const intervalMs = Math.max(15, intervalSec) * 1000; // floor at 15s to be polite
  const { buildFineTuneStore } = await import('./finetune/store.js');
  const { runPollTick } = await import('./finetune/pollWorker.js');
  const store = buildFineTuneStore();
  logger.info('llm-gateway: fine-tune poller enabled', { interval_sec: intervalMs / 1000 });

  let running = false;
  const tick = async (): Promise<void> => {
    if (running) return; // overlap guard — skip if last tick still in flight
    running = true;
    try {
      const result = await runPollTick({ store });
      if (result.scanned > 0) {
        logger.info('finetune.poll tick', {
          scanned: result.scanned,
          updated: result.updated,
          unchanged: result.unchanged,
          failed_lookup: result.failed_lookup,
          skipped: result.skipped,
          error_count: result.errors.length,
        });
      }
    } catch (err) {
      logger.error('finetune.poll tick crashed', {
        err: err instanceof Error ? err.message : String(err),
      });
    } finally {
      running = false;
    }
  };
  // First tick after the interval (not immediately) — keeps startup quiet.
  setInterval(() => { void tick(); }, intervalMs).unref();
}

async function startServer(): Promise<void> {
  try {
    const { default: app } = await import('./app.js');
    app.listen(PORT, '0.0.0.0', () => {
      logger.info('llm-gateway listening', { port: PORT, phase: 'P0' });
    });
    await startFineTunePoller();
  } catch (error) {
    logger.error('failed to start llm-gateway', {
      err: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

void startServer();
