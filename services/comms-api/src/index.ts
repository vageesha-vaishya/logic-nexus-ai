import app from './app.js';
import { deliveryWorker } from './services/delivery-worker.js';
import { doNotContactConsumer } from './services/do-not-contact-consumer.js';
import { notificationDispatcher } from './services/notification-dispatcher.js';
import { logger } from './utils/logger.js';

const port = Number(process.env.COMMS_API_PORT) || 3601;

async function bootstrap(): Promise<void> {
  // Best-effort starts. If SUPABASE_URL/SERVICE_ROLE_KEY are missing
  // the start() calls throw — log + skip so the HTTP service (incl. the
  // webhook receiver) still serves /health for the orchestrator.
  try {
    notificationDispatcher.start();
  } catch (err) {
    logger.warn('comms notification dispatcher failed to start; intents will not be fanned out', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  try {
    deliveryWorker.start();
  } catch (err) {
    logger.warn('comms delivery worker failed to start; pending deliveries will not be sent', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  try {
    doNotContactConsumer.start();
  } catch (err) {
    logger.warn('comms do-not-contact consumer failed to start; CRM do_not_contact flags will not propagate to suppressions', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ event: 'comms_api.started', port, service: 'comms-api' }));
  });
}

void bootstrap();
