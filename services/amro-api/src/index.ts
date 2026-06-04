/**
 * Server Entry Point
 * Initialize Express server and listen for connections
 */

import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';

function loadEnvironment(): void {
  const projectRoot = path.resolve(process.cwd(), '..', '..');
  const envFileOverride = String(process.env.AMRO_ENV_FILE || '').trim();
  const envCandidates = [
    envFileOverride,
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(projectRoot, '.env'),
    path.resolve(projectRoot, '.env.local'),
    path.resolve(projectRoot, '.env local docker'),
  ].filter(Boolean);
  for (const candidate of envCandidates) {
    if (!existsSync(candidate)) {
      continue;
    }
    dotenv.config({ path: candidate, override: false });
  }
}

loadEnvironment();

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isTruthy = (value: string | undefined, fallback: boolean): boolean => {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};
const kafkaEnabled = isTruthy(process.env.AMRO_KAFKA_ENABLED ?? process.env.KAFKA_ENABLED, process.env.NODE_ENV === 'production');

// Initialize Kafka producer and start server
async function startServer() {
  try {
    const [{ initializeTracing }, { default: app }, { logger }, { amroEventsProducer }] = await Promise.all([
      import('./instrumentation/tracer-provider.js'),
      import('./app.js'),
      import('./utils/logger.js'),
      import('./events/amro-events.producer.js'),
    ]);
    await initializeTracing();
    logger.info('OpenTelemetry tracing initialized');

    if (kafkaEnabled) {
      try {
        await amroEventsProducer.initialize();
        logger.info('Kafka producer initialized');
      } catch (kafkaError) {
        logger.warn('Kafka producer unavailable, continuing without event bus', {
          error: kafkaError instanceof Error ? kafkaError.message : String(kafkaError),
        });
      }
    } else {
      logger.info('Kafka bootstrap disabled for amro-api');
    }

    // Start Express server
    const server = app.listen(PORT, () => {
      logger.info(`AMRO API Server running on port ${PORT} (${NODE_ENV})`);
      logger.info(`http://localhost:${PORT}`);
    });

    // Phase 8d: env-gated core.outbox → Kafka transactional poller.
    void startAmroOutboxPoller();

    // Directive Applicability S3: env-gated amro.applicability_eval_jobs
    // batch processor. Drains pending evaluation jobs via the LLM gateway.
    void startApplicabilityWorker();

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      logger.warn('SIGTERM received, shutting down gracefully...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.warn('SIGINT received, shutting down gracefully...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function startAmroOutboxPoller(): Promise<void> {
  const raw = process.env.AMRO_OUTBOX_POLL_INTERVAL_SEC;
  const intervalSec = raw ? Number(raw) : 0;
  if (!Number.isFinite(intervalSec) || intervalSec <= 0) {
    // eslint-disable-next-line no-console
    console.log('[amro-api] outbox poller disabled (set AMRO_OUTBOX_POLL_INTERVAL_SEC to enable)');
    return;
  }
  const intervalMs = Math.max(5, intervalSec) * 1000;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    // eslint-disable-next-line no-console
    console.log('[amro-api] outbox poller wanted but SUPABASE_URL/SERVICE_ROLE_KEY missing — skipping');
    return;
  }
  const { createClient } = await import('@supabase/supabase-js');
  const { runAmroOutboxTick } = await import('./services/outbox-poller.js');
  const supabase = createClient(supabaseUrl, supabaseKey);
  // eslint-disable-next-line no-console
  console.log(`[amro-api] outbox poller enabled every ${intervalMs / 1000}s`);

  let running = false;
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const result = await runAmroOutboxTick({ supabase });
      if (result.scanned > 0 || result.errors.length > 0) {
        // eslint-disable-next-line no-console
        console.log('[amro-api] outbox tick', {
          scanned: result.scanned,
          published: result.published,
          failed: result.failed,
          errors: result.errors.length,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[amro-api] outbox tick crashed', err instanceof Error ? err.message : String(err));
    } finally {
      running = false;
    }
  };
  setInterval(() => { void tick(); }, intervalMs).unref();
}

async function startApplicabilityWorker(): Promise<void> {
  const raw = process.env.AMRO_APPLICABILITY_WORKER_INTERVAL_SEC;
  const intervalSec = raw ? Number(raw) : 0;
  if (!Number.isFinite(intervalSec) || intervalSec <= 0) {
    // eslint-disable-next-line no-console
    console.log('[amro-api] applicability worker disabled (set AMRO_APPLICABILITY_WORKER_INTERVAL_SEC to enable)');
    return;
  }
  const intervalMs = Math.max(15, intervalSec) * 1000;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const gatewayUrl = process.env.LLM_GATEWAY_URL;
  if (!supabaseUrl || !supabaseKey || !gatewayUrl) {
    // eslint-disable-next-line no-console
    console.log('[amro-api] applicability worker wanted but SUPABASE_URL/SERVICE_ROLE_KEY/LLM_GATEWAY_URL missing — skipping');
    return;
  }
  const serviceToken = process.env.LLM_GATEWAY_SERVICE_TOKEN ?? null;
  const platformId = process.env.LLM_GATEWAY_PLATFORM_ID ?? 'logic-nexus-ai';
  const workerId = `${process.env.HOSTNAME ?? 'amro-api'}-${process.pid}`;
  const jobLimitRaw = Number(process.env.AMRO_APPLICABILITY_WORKER_JOB_LIMIT ?? 5);
  const jobLimit = Number.isFinite(jobLimitRaw) && jobLimitRaw > 0 ? jobLimitRaw : 5;

  const { createClient } = await import('@supabase/supabase-js');
  const { runApplicabilityWorkerTick } = await import('./workers/applicability-worker.js');
  const supabase = createClient(supabaseUrl, supabaseKey);
  // eslint-disable-next-line no-console
  console.log(`[amro-api] applicability worker enabled every ${intervalMs / 1000}s (jobLimit=${jobLimit}, workerId=${workerId})`);

  let running = false;
  let tickCount = 0;
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    tickCount += 1;
    try {
      const result = await runApplicabilityWorkerTick({
        supabase,
        gatewayUrl,
        serviceToken,
        platformId,
        workerId,
        jobLimit,
        runRecovery: tickCount % 20 === 0,
      });
      if (result.claimed > 0 || result.errors.length > 0 || result.recoveryReset > 0) {
        // eslint-disable-next-line no-console
        console.log('[amro-api] applicability tick', {
          claimed: result.claimed,
          pairs: result.pairsProcessed,
          verdicts: result.verdictsPersisted,
          failed: result.jobsFailed,
          recovered: result.recoveryReset,
          errors: result.errors.length,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[amro-api] applicability tick crashed', err instanceof Error ? err.message : String(err));
    } finally {
      running = false;
    }
  };
  setInterval(() => { void tick(); }, intervalMs).unref();
}

const server = startServer();

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

export default server;
