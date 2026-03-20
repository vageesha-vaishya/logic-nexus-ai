import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './app';
import { crmEventsProducer } from './events/crm-events.producer';
import { financeEventsConsumer } from './events/finance-events.consumer';
import { financeEventsProducer } from './events/finance-events.producer';
import { logger } from './utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(serviceRoot, '..', '..');

dotenv.config({ path: path.join(workspaceRoot, '.env') });
dotenv.config({ path: path.join(workspaceRoot, '.env.local'), override: true });
dotenv.config({ path: path.join(serviceRoot, '.env'), override: true });

const PORT = Number(process.env.PORT || 3011);

async function startServer(): Promise<void> {
  try {
    try {
      await crmEventsProducer.initialize();
    } catch (error) {
      logger.warn('CRM events producer unavailable. Starting API without Kafka publishing.', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    try {
      await financeEventsProducer.initialize();
    } catch (error) {
      logger.warn('Finance events producer unavailable. Falling back to in-process GL posting.', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    try {
      await financeEventsConsumer.initialize();
    } catch (error) {
      logger.warn('Finance events consumer unavailable. Kafka GL events will not be processed.', {
        error: error instanceof Error ? error.message : String(error),
      });
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
