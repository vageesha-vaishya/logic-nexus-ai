import app from './app.js';
import { logisticsEventsProducer } from './events/logistics-events.producer.js';
import { logger } from './utils/logger.js';

const port = Number(process.env.LOGISTICS_API_PORT) || 3401;

async function bootstrap() {
  try {
    await logisticsEventsProducer.initialize();
    logger.info('logistics-events producer initialised');
  } catch (err) {
    logger.warn('logistics-events producer failed to initialise; events will skip', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ event: 'logistics_api.started', port, service: 'logistics-api' }));
  });
}

bootstrap();
