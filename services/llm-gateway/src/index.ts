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

async function startServer(): Promise<void> {
  try {
    const { default: app } = await import('./app.js');
    app.listen(PORT, '0.0.0.0', () => {
      logger.info('llm-gateway listening', { port: PORT, phase: 'P0' });
    });
  } catch (error) {
    logger.error('failed to start llm-gateway', {
      err: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

void startServer();
