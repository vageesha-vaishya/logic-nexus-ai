/**
 * Server Entry Point
 * Initialize Express server and listen for connections
 */

import dotenv from 'dotenv';
import { initializeTracing } from './instrumentation/tracer-provider';
import app from './app';
import { logger } from './utils/logger';
import { amroEventsProducer } from './events/amro-events.producer';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Kafka producer and start server
async function startServer() {
  try {
    // Initialize OpenTelemetry tracing
    await initializeTracing();
    logger.info('OpenTelemetry tracing initialized');

    // Initialize Kafka producer
    await amroEventsProducer.initialize();
    logger.info('Kafka producer initialized');

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
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

const server = startServer();

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled rejection:', reason);
  process.exit(1);
});

export default server;
