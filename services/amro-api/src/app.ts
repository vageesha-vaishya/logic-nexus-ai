/**
 * Express Application Setup
 * Middleware and route initialization
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { authMiddleware } from './middleware/auth.middleware';
import workOrdersRoutes from './routes/work-orders.routes';
import { ErrorResponse } from './types/amro.types';
import { logger } from './utils/logger';
import { amroEventsProducer } from './events/amro-events.producer';

const app: Express = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Parse JSON bodies
app.use(express.json());

// CORS Configuration
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ============================================================================
// HEALTH CHECK ENDPOINTS
// ============================================================================

/**
 * GET /health
 * Service health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'amro-api',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /
 * Root endpoint
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'AMRO API Service',
    version: '0.1.0',
    description: 'Asset Maintenance, Repair, and Overhaul backend service',
  });
});

// ============================================================================
// PROTECTED API ROUTES
// ============================================================================

// Apply authentication middleware to all API routes
app.use('/api/v1', authMiddleware);

// Mount work orders routes
app.use('/api/v1', workOrdersRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * 404 Handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    code: 'NOT_FOUND',
    statusCode: 404,
    path: req.path,
  } as ErrorResponse);
});

/**
 * Global Error Handler
 */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err);

  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred';

  res.status(statusCode).json({
    error: message,
    code,
    statusCode,
  } as ErrorResponse);
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

/**
 * Setup graceful shutdown to disconnect Kafka producer
 */
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await amroEventsProducer.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  await amroEventsProducer.shutdown();
  process.exit(0);
});

export default app;
