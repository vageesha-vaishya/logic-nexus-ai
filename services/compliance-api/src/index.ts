import app from './app.js';
import { complianceGatingConsumer } from './services/gating-consumer.js';
import { logger } from './utils/logger.js';

const port = Number(process.env.COMPLIANCE_API_PORT) || 3501;

async function bootstrap(): Promise<void> {
  // Best-effort consumer start. If SUPABASE_URL/SERVICE_ROLE_KEY are missing
  // the constructor throws — log + skip rather than crash the HTTP service.
  try {
    complianceGatingConsumer.start();
  } catch (err) {
    logger.warn('compliance gating consumer failed to start; events will not be processed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ event: 'compliance_api.started', port, service: 'compliance-api' }));
  });
}

void bootstrap();
