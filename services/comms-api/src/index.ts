import app from './app.js';
import { notificationDispatcher } from './services/notification-dispatcher.js';
import { logger } from './utils/logger.js';

const port = Number(process.env.COMMS_API_PORT) || 3601;

async function bootstrap(): Promise<void> {
  // Best-effort dispatcher start. If SUPABASE_URL/SERVICE_ROLE_KEY are
  // missing the start() call throws — log + skip so the HTTP service
  // still serves /health for the orchestrator.
  try {
    notificationDispatcher.start();
  } catch (err) {
    logger.warn('comms notification dispatcher failed to start; intents will not be fanned out', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ event: 'comms_api.started', port, service: 'comms-api' }));
  });
}

void bootstrap();
