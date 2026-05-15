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
      import('./instrumentation/tracer-provider'),
      import('./app'),
      import('./utils/logger'),
      import('./events/amro-events.producer'),
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
