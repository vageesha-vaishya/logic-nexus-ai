import app from './app.js';
import { financeEventsProducer } from './events/finance-events.producer.js';
import { financeEventsConsumer } from './events/finance-events.consumer.js';
import { crossModuleConsumer } from './services/cross-module-consumer.js';
import { logger } from './utils/logger.js';

const port = Number(process.env.FINANCE_API_PORT) || 3301;

async function bootstrap() {
  // Initialise Kafka producer + consumer in best-effort mode. If Kafka
  // isn't reachable, the producer's publishLeadEvent / publishInvoiceEvent
  // calls log warnings and skip — the HTTP service still serves requests.
  try {
    await financeEventsProducer.initialize();
    logger.info('finance-events producer initialised');
  } catch (err) {
    logger.warn('finance-events producer failed to initialise; events will skip', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  try {
    await financeEventsConsumer.initialize();
    logger.info('finance-events consumer initialised');
  } catch (err) {
    logger.warn('finance-events consumer failed to initialise; GL posting will not run', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Cross-module consumer polls core.v_cross_module_pending_events on
  // an interval. Best-effort: if SUPABASE_URL/SERVICE_ROLE_KEY are
  // missing, the constructor throws — log + skip rather than crash the
  // HTTP service.
  try {
    crossModuleConsumer.start();
  } catch (err) {
    logger.warn('cross-module consumer failed to start; events will not be processed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ event: 'finance_api.started', port, service: 'finance-api' }));
  });
}

bootstrap();
