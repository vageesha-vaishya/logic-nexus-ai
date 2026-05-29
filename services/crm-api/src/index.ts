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

const PORT = Number(process.env.PORT || 3011);
const isTruthy = (value: string | undefined, fallback: boolean): boolean => {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};
const kafkaEnabled = isTruthy(process.env.CRM_KAFKA_ENABLED ?? process.env.KAFKA_ENABLED, process.env.NODE_ENV === 'production');

async function startServer(): Promise<void> {
  try {
    // Finance event producer/consumer moved to services/finance-api/ in Phase 5.
    // crm-events.producer is dead post-Phase-4 (sales-api owns lead events now)
    // but the import stays until a separate cleanup retires it.
    const [{ default: app }, { crmEventsProducer }] = await Promise.all([
      import('./app.js'),
      import('./events/crm-events.producer.js'),
    ]);

    if (kafkaEnabled) {
      try {
        await crmEventsProducer.initialize();
      } catch (error) {
        logger.warn('CRM events producer unavailable. Starting API without Kafka publishing.', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      logger.info('Kafka bootstrap disabled for crm-api');
    }

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`crm-api listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start crm-api', error);
    process.exit(1);
  }
}

void startServer();
