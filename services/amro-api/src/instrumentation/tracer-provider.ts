/**
 * Tracer Provider Initialization
 * Sets up OpenTelemetry SDK Node with OTLP exporter
 * Call initializeTracing() at application startup
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { logger } from '../utils/logger.js';

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry SDK with OTLP exporter
 * Should be called before creating any spans or starting the application
 *
 * Environment variables:
 * - OTEL_EXPORTER_OTLP_ENDPOINT: OTLP collector endpoint (default: http://localhost:4318)
 * - OTEL_SERVICE_NAME: Service name (default: amro-service)
 * - OTEL_LOG_LEVEL: Log level for OTel (debug, info, warn, error)
 *
 * @returns Promise that resolves when SDK is initialized
 */
export async function initializeTracing(): Promise<void> {
  try {
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
    const serviceName = process.env.OTEL_SERVICE_NAME || 'amro-service';

    logger.info(`Initializing OpenTelemetry with endpoint: ${endpoint}`);

    // Create OTLP exporter for traces
    const otlpExporter = new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
      headers: {
        'Content-Type': 'application/json',
      },
      // Disable keep-alive for development environments
      keepAlive: process.env.NODE_ENV === 'production',
      // Shorter timeout for faster failure in development
      timeoutMillis: 5000,
    });

    // Initialize SDK with auto-instrumentation
    sdk = new NodeSDK({
      serviceName,
      traceExporter: otlpExporter,
      instrumentations: [getNodeAutoInstrumentations()],
    });

    // Start the SDK
    await sdk.start();
    logger.info(`OpenTelemetry SDK initialized successfully for service: ${serviceName}`);

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down OpenTelemetry SDK...');
      try {
        await sdk?.shutdown();
        logger.info('OpenTelemetry SDK shut down successfully');
      } catch (error) {
        logger.error('Error shutting down OpenTelemetry SDK:', error);
      }
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down OpenTelemetry SDK...');
      try {
        await sdk?.shutdown();
        logger.info('OpenTelemetry SDK shut down successfully');
      } catch (error) {
        logger.error('Error shutting down OpenTelemetry SDK:', error);
      }
    });
  } catch (error) {
    // Log the error but don't fail startup - tracing is not critical
    logger.error('Failed to initialize OpenTelemetry:', error);
    logger.warn('Application will continue without tracing');
  }
}

/**
 * Shutdown the OpenTelemetry SDK
 * Should be called during graceful shutdown
 *
 * @returns Promise that resolves when SDK is shut down
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
      logger.info('OpenTelemetry SDK shut down successfully');
      sdk = null;
    } catch (error) {
      logger.error('Error shutting down OpenTelemetry SDK:', error);
    }
  }
}

/**
 * Check if tracing is initialized
 * @returns true if SDK is initialized and running
 */
export function isTracingInitialized(): boolean {
  return sdk !== null;
}
