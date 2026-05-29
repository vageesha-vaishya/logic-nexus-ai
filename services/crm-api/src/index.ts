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
  // Post-Phase-5 crm-api is an auth+audit shim — leads moved to
  // sales-api (commit 37778d2c) and invoices/tax/billing/gl moved to
  // finance-api (commit 54e8ed0b). No Kafka producer or consumer left
  // here. The CRM_KAFKA_ENABLED env stays read-but-unused so existing
  // deployment configs don't break, but no behaviour hangs off it.
  if (kafkaEnabled) {
    logger.info('CRM_KAFKA_ENABLED is set, but crm-api no longer owns any Kafka publishers — value ignored.');
  }
  try {
    const { default: app } = await import('./app.js');
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`crm-api listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start crm-api', error);
    process.exit(1);
  }
}

void startServer();
